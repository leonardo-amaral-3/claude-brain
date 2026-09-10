// Eleição de escritor único do índice, por lease gravado no próprio brain.db.
//
// O PORQUÊ, e ele governa todo o resto deste arquivo: o lease é OTIMIZAÇÃO, não é o mecanismo
// de correção. Quem garante que duas escritas simultâneas não corrompem o banco continua sendo
// o SQLite (WAL + busy_timeout + transações). O lease existe para eliminar TRABALHO DUPLICADO —
// N sessões varrendo os mesmos 5.767 arquivos, N reconstruções do mesmo grafo, N cálculos do
// mesmo vetor, N chamadas `gh issue list` — e as tempestades de lock que vinham disso.
//
// Consequência prática, e é de propósito: uma sobreposição rara de escritores na janela de troca
// de líder é ACEITÁVEL. Ela degrada para o comportamento anterior a esta feature, que já era
// seguro quanto a dado. Por isso aqui não há fencing token, não há quórum, não há watchdog. Quem
// for endurecer este lease depois: comece perguntando qual corrupção ele impede — se a resposta
// for "nenhuma, o SQLite já impede", o endurecimento é custo sem receita.
//
// A identidade do dono é um UUID por INSTÂNCIA de processo, nunca o pid: o SO recicla pid, e um
// processo novo que herdasse o pid de um líder morto renovaria um lease que não é dele — dois
// escritores coexistindo sem que nada percebesse. `pid` e `host` ficam na tabela só para
// diagnóstico (é o que a CLI mostra ao recusar).

import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { Db } from "./db.js";

// ATENÇÃO: `Number(bruto) || 60_000` estaria ERRADO. BRAIN_LEASE_TTL_MS=0 é o desligamento a
// quente descrito no `## Rollback` da spec (todo lease nasce vencido, todo processo se elege
// líder, o comportamento antigo volta sem deploy) — e 0 é falsy, então o padrão comeria
// justamente o valor que alguém digitou para apagar um incêndio. Tem de ser undefined-check.
const bruto = process.env.BRAIN_LEASE_TTL_MS;
export const TTL_MS = bruto === undefined || Number.isNaN(Number(bruto)) ? 60_000 : Number(bruto);

// Um terço do TTL: dá três tentativas de renovação antes de vencer, e é também o atraso máximo
// da tomada de posse depois de uma saída graciosa. O piso de 1 s impede que TTL 0 (o
// desligamento acima) vire um timer de intervalo 0 queimando CPU.
export const TIQUE_MS = Math.max(1_000, Math.floor(TTL_MS / 3) || 1_000);

export interface DonoLease {
  instancia: string;
  pid: number;
  host: string;
  inicio: number;
  expiraEm: number;
}

interface LinhaLider {
  instancia: string;
  pid: number;
  host: string;
  inicio: number;
  expira_em: number;
}

// Os dois SQLs saem da MESMA base de propósito: duplicar a lista de colunas seria convite a
// acrescentar um campo num e esquecer no outro.
// Params 1..5: instancia, pid, host, inicio, expira_em.
const SQL_ADQUIRIR_BASE = `
  INSERT INTO lider (id, instancia, pid, host, inicio, expira_em)
  VALUES (1, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    instancia = excluded.instancia, pid = excluded.pid, host = excluded.host,
    inicio = excluded.inicio, expira_em = excluded.expira_em
`;

// Com o WHERE (param 6 = agora): só ganha quem acha o lease vencido, ou quem já era o dono.
const SQL_ADQUIRIR =
  SQL_ADQUIRIR_BASE + "  WHERE lider.expira_em < ? OR lider.instancia = excluded.instancia\n";

// Sem o WHERE do DO UPDATE: toma a liderança de quem estiver com ela. É a escapatória explícita
// do `--force` da CLI e do `forcar: true` da tool reindex, nunca o caminho automático.
const SQL_ADQUIRIR_FORCADO = SQL_ADQUIRIR_BASE;

/** `run().changes` pode vir bigint no node:sqlite — comparar com `=== 1` daria falso sempre. */
function mudou(changes: number | bigint): boolean {
  return Number(changes) > 0;
}

export class Lease {
  private readonly instancia = randomUUID();
  private readonly host = hostname();
  private lider = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(private db: Db) {}

  get souLider(): boolean {
    return this.lider;
  }

  /**
   * Aquisição em UM statement — portanto atômica em autocommit, sem BEGIN. Ganha quem insere a
   * primeira linha, quem toma um lease vencido, ou quem já era o dono (renovação disfarçada).
   */
  tentarAdquirir(forcar = false): boolean {
    const agora = Date.now();
    const sql = forcar ? SQL_ADQUIRIR_FORCADO : SQL_ADQUIRIR;
    const args: unknown[] = [this.instancia, process.pid, this.host, agora, agora + TTL_MS];
    if (!forcar) args.push(agora);
    const r = this.db.prepare(sql).run(...(args as never[]));
    this.lider = mudou(r.changes);
    return this.lider;
  }

  /** `false` = outro processo tomou o lease; quem chamou deve se rebaixar a seguidor. */
  renovar(): boolean {
    const r = this.db
      .prepare("UPDATE lider SET expira_em = ? WHERE id = 1 AND instancia = ?")
      .run(Date.now() + TTL_MS, this.instancia);
    this.lider = mudou(r.changes);
    return this.lider;
  }

  /**
   * Idempotente e condicionado à instância, para nunca apagar o lease de outro. É um DELETE
   * síncrono, logo legítimo dentro de um handler de `exit`, onde só código síncrono roda.
   */
  liberar(): void {
    this.db.prepare("DELETE FROM lider WHERE id = 1 AND instancia = ?").run(this.instancia);
    this.lider = false;
  }

  dono(): DonoLease | null {
    const l = this.db.prepare("SELECT * FROM lider WHERE id = 1").get() as unknown as
      | LinhaLider
      | undefined;
    if (!l) return null;
    return {
      instancia: l.instancia,
      pid: Number(l.pid),
      host: l.host,
      inicio: Number(l.inicio),
      expiraEm: Number(l.expira_em),
    };
  }

  /**
   * Um timer só, com os dois papéis: líder renova, seguidor tenta tomar. É o segundo papel que
   * dá a tomada de posse após morte abrupta de graça — sem watchdog, sem daemon, sem ninguém
   * vigiando ninguém: o sucessor simplesmente acha o lease vencido no tique seguinte.
   */
  iniciarTique(aoAssumir: () => void, aoPerder: () => void): void {
    this.pararTique();
    this.timer = setInterval(() => {
      try {
        if (this.lider) {
          if (!this.renovar()) aoPerder();
        } else if (this.tentarAdquirir()) {
          aoAssumir();
        }
      } catch (err) {
        // Banco ocupado neste tique não muda o papel de ninguém: se a renovação seguir
        // falhando, o lease vence sozinho e o TTL resolve. Derrubar o processo por isso, não.
        console.error("[brain] tique do lease falhou:", err);
      }
    }, TIQUE_MS);
    // Um timer que segura o processo vivo trava o encerramento da sessão (padrão de vigia.ts).
    this.timer.unref?.();
  }

  pararTique(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

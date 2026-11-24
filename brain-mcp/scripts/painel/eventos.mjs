// Leitor do diario de telemetria (claude-brain#66, F1). So le: quem grava e hooks/telemetria.js.
//
// O formato e o `### Contrato do evento` de planning/66-telemetria/spec.md: um arquivo por dia UTC
// (`eventos-AAAA-MM-DD.jsonl`), uma linha JSON por evento, `v: 1`. Linha que nao e JSON e linha de
// outra versao nao derrubam a leitura: sao contadas (`invalidas`, `outraVersao`) e o painel as mostra.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", ".."); // brain-mcp/
const require = createRequire(import.meta.url);
const PADRAO = /^eventos-(\d{4}-\d{2}-\d{2})\.jsonl$/;
const dataUtc = (ts) => new Date(ts).toISOString().slice(0, 10);

/**
 * Le os arquivos do diario cujas datas cobrem [desde, ate) e devolve os eventos v=1 com ts nesse
 * intervalo, em ordem de ts. `desde` e `ate` sao ms (epoch).
 * @returns {{ eventos: object[], invalidas: number, outraVersao: number, arquivos: number }}
 */
export function lerEventos({ dir, desde, ate }) {
  const saida = { eventos: [], invalidas: 0, outraVersao: 0, arquivos: 0 };
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) return saida;
  const primeiro = dataUtc(desde);
  const ultimo = dataUtc(ate - 1); // `ate` e exclusivo: o dia que ele abre so entra se houver ms dentro
  for (const nome of readdirSync(dir).sort()) {
    const m = PADRAO.exec(nome);
    if (!m || m[1] < primeiro || m[1] > ultimo) continue;
    saida.arquivos++;
    for (const linha of readFileSync(join(dir, nome), "utf8").split("\n")) {
      if (linha === "") continue;
      let e;
      try {
        e = JSON.parse(linha);
      } catch {
        saida.invalidas++;
        continue;
      }
      if (e === null || typeof e !== "object" || Array.isArray(e)) {
        saida.invalidas++;
        continue;
      }
      if (e.v !== 1) {
        // Versao que este leitor nao conhece: so conta, e so se o ts (quando ha) cai no periodo.
        if (typeof e.ts !== "number" || (e.ts >= desde && e.ts < ate)) saida.outraVersao++;
        continue;
      }
      if (typeof e.ts !== "number") {
        saida.invalidas++; // v=1 sem ts numerico: nao da para datar, e sumir calado esconderia a perda
        continue;
      }
      if (e.ts >= desde && e.ts < ate) saida.eventos.push(e);
    }
  }
  saida.eventos.sort((a, b) => a.ts - b.ts);
  return saida;
}

/**
 * O `dirTelemetria` do hooks/telemetria.js, achado como `sem-jev.mjs` acha o jev.js: o layout do repo
 * (`<raiz>/../hooks`), depois o da instalacao (`<CLAUDE_HOME>/hooks`). Sem nenhum dos dois, aplica a
 * mesma regra aqui (BRAIN_TELEMETRIA_DIR, senao <CLAUDE_HOME>/brain-telemetria).
 */
export function dirPadrao(env = process.env) {
  const casa = env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  for (const caminho of [join(raiz, "..", "hooks", "telemetria.js"), join(casa, "hooks", "telemetria.js")]) {
    if (!existsSync(caminho)) continue;
    try {
      const gravador = require(caminho);
      if (typeof gravador.dirTelemetria === "function") return gravador.dirTelemetria(env);
    } catch {
      /* tenta o proximo */
    }
  }
  return env.BRAIN_TELEMETRIA_DIR ? env.BRAIN_TELEMETRIA_DIR : join(casa, "brain-telemetria");
}

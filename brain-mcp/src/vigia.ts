// Mantém o índice fresco SEM cobrar isso da latência da consulta.
//
// Antes, toda busca chamava scanIfStale() de forma síncrona: se fizesse mais de 5 minutos
// desde a última varredura, a consulta pagava a varredura inteira dos 13 repos. Funcionava
// com 3 mil arquivos e ia degradar junto com o workspace.
//
// Agora: watcher nas pastas de documento (pequenas, mudam a toda hora — planning, diário,
// decisões, memória, mapas) e varredura periódica para o resto. Código não é vigiado de
// propósito: fs.watch recursivo num repo com node_modules é caro e o ganho é nenhum, já que
// código muda em rajada e a varredura periódica cobre.

import { watch, type FSWatcher } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { BrainConfig } from "./config.js";
import type { Indexer } from "./indexer.js";

const DEBOUNCE_MS = 1500;
const PERIODICO_MS = 5 * 60 * 1000;

/** Raiz que é (ou contém) repo: vigiar recursivamente traria node_modules junto. */
function pesada(dir: string): boolean {
  if (existsSync(join(dir, "node_modules")) || existsSync(join(dir, ".git"))) return true;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const filho = join(dir, e.name);
      if (existsSync(join(filho, "node_modules")) || existsSync(join(filho, ".git"))) return true;
    }
  } catch {
    return true; // se nem dá para listar, não vale vigiar
  }
  return false;
}

export class Vigia {
  private watchers: FSWatcher[] = [];
  private timerDebounce: NodeJS.Timeout | null = null;
  private timerPeriodico: NodeJS.Timeout | null = null;
  private varrendo = false;

  constructor(
    private cfg: BrainConfig,
    private indexer: Indexer,
    private aoVarrer: (motivo: string, indexados: number) => void = () => {}
  ) {}

  iniciar(): { vigiados: number } {
    let vigiados = 0;
    for (const raiz of this.cfg.roots) {
      if (raiz.kind === "code") continue; // ver comentário do topo
      if (!existsSync(raiz.path)) continue;
      // Várias raízes de "notas" apontam para a raiz de um repo — ou para uma pasta que
      // CONTÉM repos (notoria/faturamento). Vigiar isso recursivamente arrastaria
      // node_modules junto, que é exatamente o custo que este desenho existe para evitar.
      if (pesada(raiz.path)) continue;
      try {
        const w = watch(raiz.path, { recursive: true, persistent: false }, (_ev, nome) => {
          if (typeof nome === "string" && !nome.endsWith(".md")) return;
          this.agendar("watcher");
        });
        w.on("error", () => {
          /* raiz sumiu ou FS não suporta: a varredura periódica cobre */
        });
        this.watchers.push(w);
        vigiados++;
      } catch {
        /* sem watcher para esta raiz; segue com o periódico */
      }
    }

    this.timerPeriodico = setInterval(() => this.varrer("periodico"), PERIODICO_MS);
    this.timerPeriodico.unref?.();
    return { vigiados };
  }

  /** Agenda varredura com debounce. Nunca bloqueia quem chamou. */
  agendar(motivo: string): void {
    if (this.timerDebounce) clearTimeout(this.timerDebounce);
    this.timerDebounce = setTimeout(() => this.varrer(motivo), DEBOUNCE_MS);
    this.timerDebounce.unref?.();
  }

  private varrer(motivo: string): void {
    if (this.varrendo) return;
    this.varrendo = true;
    try {
      const s = this.indexer.scan();
      if (s.indexed || s.removed) this.aoVarrer(motivo, s.indexed);
    } catch (err) {
      console.error("[brain] varredura falhou:", err);
    } finally {
      this.varrendo = false;
    }
  }

  parar(): void {
    for (const w of this.watchers) w.close();
    this.watchers = [];
    if (this.timerDebounce) clearTimeout(this.timerDebounce);
    if (this.timerPeriodico) clearInterval(this.timerPeriodico);
  }
}

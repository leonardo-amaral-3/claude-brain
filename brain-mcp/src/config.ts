import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface RootConfig {
  path: string;
  source: "planning" | "docs" | "diario" | "memoria" | "mapa" | "notas" | "code" | "github" | "decisao" | "git";
  repo: string | null;
  recursive?: boolean;
  kind?: "docs" | "code";
  excludeFiles?: string[];
}

export interface GithubSection {
  repos: string[];
  syncIntervalMin: number;
  commentsSinceDays: number;
  maxItems: number;
}

export interface GitSection {
  repos: { path: string; repo: string }[];
  desde: string;
  maximo: number;
}

export interface BrainConfig {
  /** Variaveis do usuario usadas como ${NOME} nos caminhos. Ex.: { "WS": "${HOME}/meu-workspace" } */
  vars?: Record<string, string>;
  /** Nome do produto, citado na descricao das tools. Ajuda o modelo a saber de que indice se trata. */
  produto?: string;
  /** Sinonimos do SEU dominio, somados aos embutidos. Ex.: { "nfe": ["nota", "fiscal"] } */
  sinonimos?: Record<string, string[]>;
  roots: RootConfig[];
  codeExtensions: string[];
  excludeDirs: string[];
  excludeFiles: string[];
  maxCodeFileBytes: number;
  github: GithubSection;
  git: GitSection;
}

const here = dirname(fileURLToPath(import.meta.url));
// dist/config.js -> raiz do pacote é um nível acima
export const packageRoot = join(here, "..");

const barras = (p: string) => p.split("\\").join("/");

/**
 * Caminhos do config aceitam ${VAR}. Sem isso o arquivo so serve na maquina de quem o escreveu —
 * e ele e justamente a parte que muda de dev para dev. Caminho absoluto continua valendo como
 * sempre: quem nao usa variavel nao paga nada.
 *
 * Embutidas: HOME (pasta do usuario), CLAUDE_HOME (~/.claude ou $CLAUDE_CONFIG_DIR),
 * BRAIN_ROOT (esta pasta). O bloco `vars` do config acrescenta as suas, e uma pode citar outra.
 */
function construirVars(cfg: BrainConfig): Record<string, string> {
  const vars: Record<string, string> = {
    HOME: barras(homedir()),
    CLAUDE_HOME: barras(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude")),
    BRAIN_ROOT: barras(packageRoot),
  };
  // Duas passadas bastam para `vars` citar embutidas e umas as outras sem virar resolvedor de grafo.
  for (const [k, v] of Object.entries(cfg.vars || {})) vars[k] = expandir(v, vars);
  for (const k of Object.keys(cfg.vars || {})) vars[k] = expandir(vars[k], vars);
  return vars;
}

function expandir(valor: string, vars: Record<string, string>): string {
  const saida = valor.replace(/\$\{(\w+)\}/g, (todo, nome: string) => {
    const v = vars[nome] ?? process.env[nome];
    if (v === undefined) throw new Error(`brain.config.json: variavel \${${nome}} nao definida (veja o bloco "vars")`);
    return barras(v);
  });
  // Sobrou um `${`? O nome nao casou o \w+ do regex (`${WS-1}`, `${ WS }`) e passaria reto.
  // Falhar aqui e obrigatorio: um caminho meio-expandido vira pasta LITERAL na primeira escrita,
  // e a tool que escreveu jura que gravou. Ja aconteceu — melhor o servidor nem subir.
  if (saida.includes("${")) {
    throw new Error(`brain.config.json: "${valor}" tem variavel malformada — use \${NOME} com letras, numeros ou _`);
  }
  return saida;
}

/** Caminho do config: $BRAIN_CONFIG, ou brain.config.json ao lado do pacote. */
export const configPath = process.env.BRAIN_CONFIG || join(packageRoot, "brain.config.json");

export function loadConfig(): BrainConfig {
  const cfg = JSON.parse(readFileSync(configPath, "utf8")) as BrainConfig;
  const vars = construirVars(cfg);
  for (const root of cfg.roots) {
    root.path = expandir(root.path, vars);
    if (root.recursive === undefined) root.recursive = true;
  }
  for (const r of cfg.git.repos) r.path = expandir(r.path, vars);
  return cfg;
}

/**
 * Caminho do banco: $BRAIN_DB, ou data/brain.db ao lado do pacote — mesmo padrão de BRAIN_CONFIG
 * acima, e o padrão é o valor de sempre, então nenhuma instalação percebe. Existe porque sem ele
 * o teste de concorrência seria impossível ou destrutivo: só há um banco, e é o índice vivo.
 */
export const dbPath = process.env.BRAIN_DB || join(packageRoot, "data", "brain.db");

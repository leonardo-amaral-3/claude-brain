// Histórico de git como fonte indexável.
//
// A mensagem de commit é o "por quê" mais denso que existe no repositório — e era a única
// fonte grande que o cérebro ignorava por completo. O diff conta o que mudou; só a mensagem
// conta por que alguém achou que valia mudar.
//
// Os commits viram um markdown por repo/mês, com um commit por heading H2 — assim o chunker
// existente produz naturalmente um chunk por commit, sem caso especial. Um `commits.jsonl`
// paralelo guarda a forma estruturada, que o grafo usa para ligar commit → card → arquivo.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RS = "\x1e";
const US = "\x1f";

export interface Commit {
  sha: string;
  curto: string;
  data: string;
  autor: string;
  assunto: string;
  corpo: string;
  arquivos: string[];
  cards: number[];
}

export interface StatsGit {
  repos: number;
  commits: number;
  arquivos: number;
  ms: number;
  erros: string[];
}

function lerCommits(repoDir: string, desde: string, maximo: number): Commit[] {
  const saida = execFileSync(
    "git",
    [
      "-C",
      repoDir,
      "log",
      `--since=${desde}`,
      `--max-count=${maximo}`,
      "--date=short",
      "--name-only",
      "--no-merges",
      `--pretty=format:${RS}%H${US}%h${US}%ad${US}%an${US}%s${US}%b${US}`,
    ],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
  );

  const commits: Commit[] = [];
  for (const bruto of saida.split(RS)) {
    if (!bruto.trim()) continue;
    const partes = bruto.split(US);
    if (partes.length < 7) continue;
    const [sha, curto, data, autor, assunto, corpo, resto] = partes;
    const arquivos = resto
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const texto = assunto + "\n" + corpo;
    const cards = [...new Set([...texto.matchAll(/#(\d{3,5})\b/g)].map((m) => Number(m[1])))];
    commits.push({ sha, curto, data, autor, assunto, corpo: corpo.trim(), arquivos, cards });
  }
  return commits;
}

function escreverMes(dir: string, repo: string, mes: string, commits: Commit[]): void {
  const linhas: string[] = [
    "---",
    `data: ${commits[0].data}`,
    "tipo: git",
    `repo: ${repo}`,
    `mes: ${mes}`,
    `commits: ${commits.length}`,
    "---",
    "",
    `# Commits de ${repo} — ${mes}`,
    "",
  ];
  for (const c of commits) {
    linhas.push(`## ${c.curto} — ${c.assunto}`, "", `${c.data} · ${c.autor}`, "");
    if (c.corpo) linhas.push(c.corpo, "");
    if (c.arquivos.length) {
      const mostra = c.arquivos.slice(0, 25);
      linhas.push(
        "Arquivos: " + mostra.map((a) => "`" + a + "`").join(", ") +
          (c.arquivos.length > mostra.length ? ` (+${c.arquivos.length - mostra.length})` : ""),
        ""
      );
    }
  }
  writeFileSync(join(dir, `${mes}.md`), linhas.join("\n"), "utf8");
}

export interface RepoGit {
  path: string;
  repo: string;
}

export function sincronizarGit(
  repos: RepoGit[],
  destino: string,
  opts: { desde?: string; maximo?: number } = {}
): StatsGit {
  const t0 = Date.now();
  const desde = opts.desde ?? "24 months ago";
  const maximo = opts.maximo ?? 4000;
  const stats: StatsGit = { repos: 0, commits: 0, arquivos: 0, ms: 0, erros: [] };

  for (const r of repos) {
    if (!existsSync(join(r.path, ".git"))) continue;
    let commits: Commit[];
    try {
      commits = lerCommits(r.path, desde, maximo);
    } catch (err) {
      stats.erros.push(`${r.repo}: ${(err as Error).message?.split("\n")[0]}`);
      continue;
    }
    if (commits.length === 0) continue;

    const dir = join(destino, "docs", r.repo);
    mkdirSync(dir, { recursive: true });

    const porMes = new Map<string, Commit[]>();
    for (const c of commits) {
      const mes = c.data.slice(0, 7);
      if (!porMes.has(mes)) porMes.set(mes, []);
      porMes.get(mes)!.push(c);
    }
    for (const [mes, lista] of porMes) {
      escreverMes(dir, r.repo, mes, lista);
      stats.arquivos++;
    }

    // Forma estruturada, para o grafo. Só commits que citam card — são os que ligam
    // história a intenção; o resto já está coberto pela busca textual.
    const comCard = commits.filter((c) => c.cards.length > 0);
    mkdirSync(join(destino, "meta"), { recursive: true });
    writeFileSync(
      join(destino, "meta", `${r.repo}.jsonl`),
      comCard
        .map((c) =>
          JSON.stringify({
            sha: c.curto,
            repo: r.repo,
            data: c.data,
            assunto: c.assunto,
            cards: c.cards,
            arquivos: c.arquivos.slice(0, 40),
          })
        )
        .join("\n"),
      "utf8"
    );

    stats.repos++;
    stats.commits += commits.length;
  }

  stats.ms = Date.now() - t0;
  return stats;
}

export function lerCommitsEstruturados(destino: string, repos: string[]): {
  sha: string;
  repo: string;
  data: string;
  assunto: string;
  cards: number[];
  arquivos: string[];
}[] {
  const fora: ReturnType<typeof lerCommitsEstruturados> = [];
  for (const repo of repos) {
    const f = join(destino, "meta", `${repo}.jsonl`);
    if (!existsSync(f)) continue;
    for (const linha of readFileSync(f, "utf8").split("\n")) {
      if (!linha.trim()) continue;
      try {
        fora.push(JSON.parse(linha));
      } catch {
        /* linha corrompida: ignora */
      }
    }
  }
  return fora;
}

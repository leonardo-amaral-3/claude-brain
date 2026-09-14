// Prova do card #21: a tabela `## Qual modelo roda cada estação` de docs/esteira-gm.md é a fonte da
// verdade do modelo de cada skill gm-*, e este script confere que os `SKILL.md` dizem o mesmo que
// ela — no repo e na instalação que o Claude Code carrega de fato.
//
//   node scripts/prova-modelo.mjs [--repo <dir>]          estática: tabela × repo × instalação, sem custo
//   node scripts/prova-modelo.mjs --viva [--repo <dir>]   estática e, se verde, as sondas vivas (gasta cota)
//
// Saída: 0 tudo verde · 1 alguma FALHA · 2 uso errado.
//
// Por que conferir a instalação, e não só o repo: o Claude Code lê `<CLAUDE_HOME>/skills`, que não é
// repositório. Frontmatter certo no repo e velho na instalação é a skill rodando no modelo errado sem
// ninguém ver — neste repo o deploy é o `./sync.sh push`, e esquecê-lo tem de dar FALHA.
// `CLAUDE_CONFIG_DIR` vale como no Claude Code, e é ele que deixa rodar a estática contra uma
// instalação de mentira, numa cópia, sem tocar na de verdade.
//
// Por que a tabela é lida do doc, e não repetida aqui: uma segunda lista seria outra fonte da
// verdade, e a divergência entre as duas é justamente o que este script existe para pegar.
//
// Por que a viva exige a estática verde: as sondas abrem sessões de verdade e gastam cota. Com a
// tabela quebrada ou a instalação desatualizada, elas provariam o modelo errado, ou nada, e
// cobrariam do mesmo jeito.
//
// Todo texto lido passa de CRLF para LF antes de qualquer comparação: um arquivo salvo com CRLF no
// Windows não é frontmatter quebrado, e não pode virar FALHA.
import fs from "node:fs";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USO = "uso: node scripts/prova-modelo.mjs [--viva] [--repo <dir>]";
const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), ".claude");
const SECAO = "## Qual modelo roda cada estação";
const IDS = ["claude-sonnet-5", "claude-opus-5", "claude-fable-5-1"];

function ler(caminho) {
  return fs.readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
}

// null = uso errado. `--repo` seguido de outra flag conta como `--repo` sem valor.
function lerArgs(argv) {
  let viva = false;
  let repo = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--viva") viva = true;
    else if (argv[i] === "--repo") {
      const valor = argv[++i];
      if (valor === undefined || valor === "" || valor.startsWith("--")) return null;
      repo = resolve(valor);
    } else return null;
  }
  return { viva, repo };
}

// Da linha igual a SECAO até o próximo heading de nível 2, exclusive. Os `### ` internos não
// encerram a seção. null = seção ausente.
function lerTabela(repo) {
  const doc = join(repo, "docs", "esteira-gm.md");
  const linhas = fs.existsSync(doc) ? ler(doc).split("\n") : [];
  const inicio = linhas.indexOf(SECAO);
  if (inicio === -1) return null;
  const linhasTabela = [];
  for (let i = inicio + 1; i < linhas.length && !linhas[i].startsWith("## "); i++) {
    const m = linhas[i].match(/^\|\s*`(gm-[a-z-]+)`\s*\|\s*`([^`]+)`\s*\|/);
    if (m) linhasTabela.push({ skill: m[1], valor: m[2] });
  }
  return linhasTabela;
}

function skillsDoRepo(repo) {
  const pasta = join(repo, "skills");
  if (!fs.existsSync(pasta)) return new Set();
  return new Set(
    fs
      .readdirSync(pasta, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith("gm-") && fs.existsSync(join(pasta, d.name, "SKILL.md")))
      .map((d) => d.name)
      .sort(),
  );
}

function conferirFrontmatter(onde, caminho, skill, esperado, falha) {
  const linhas = ler(caminho).split("\n");
  if (linhas[0] !== "---") return falha(skill, `${onde} ${skill} sem frontmatter`);
  const fim = linhas.indexOf("---", 1);
  if (fim === -1) return falha(skill, `${onde} ${skill} com frontmatter sem fechamento`);
  const frontmatter = linhas.slice(1, fim);

  const models = frontmatter.filter((l) => /^model:/.test(l));
  if (models.length === 0) falha(skill, `${onde} ${skill} sem model:`);
  else if (models.length > 1) falha(skill, `${onde} ${skill} com ${models.length} linhas model:`);
  else {
    const m = models[0].match(/^model:\s*(\S+)\s*$/);
    if (!m) falha(skill, `${onde} ${skill} com model: malformado (${models[0]})`);
    else if (m[1] !== esperado) falha(skill, `${onde} ${skill} declara ${m[1]}, a tabela diz ${esperado}`);
  }
  if (frontmatter.some((l) => /^effort:/.test(l))) {
    falha(skill, `${onde} ${skill} declara effort: (a spec do #21 decidiu só modelo)`);
  }
}

// Coleta todas as falhas antes de devolver: quem conserta a tabela quer a lista inteira de uma vez,
// e não uma FALHA por rodada.
function estatica(repo) {
  const falhas = [];
  const comFalha = new Set();
  const falha = (skill, mensagem) => {
    falhas.push(`FALHA: ${mensagem}`);
    if (skill) comFalha.add(skill);
  };

  const linhasTabela = lerTabela(repo);
  if (linhasTabela === null) {
    falha(null, `docs/esteira-gm.md sem a seção "${SECAO}"`);
    return { falhas, verdes: [] };
  }

  const tabela = new Map(); // skill → valor, na ordem da primeira aparição
  const vezes = new Map();
  for (const { skill, valor } of linhasTabela) {
    if (!tabela.has(skill)) tabela.set(skill, valor);
    vezes.set(skill, (vezes.get(skill) ?? 0) + 1);
  }
  for (const [skill, n] of vezes) if (n > 1) falha(skill, `${skill} aparece ${n} vezes na tabela`);

  const skillsRepo = skillsDoRepo(repo);
  for (const skill of skillsRepo) if (!tabela.has(skill)) falha(skill, `${skill} sem linha na tabela`);
  for (const skill of tabela.keys()) {
    if (!skillsRepo.has(skill)) falha(skill, `${skill} está na tabela e não existe em skills/`);
  }

  for (const { skill, valor } of linhasTabela) {
    if (!IDS.includes(valor) && valor !== "inherit") {
      falha(skill, `${skill} declara "${valor}" na tabela — use id completo (IDS) ou inherit`);
    }
  }

  for (const [skill, valor] of tabela) {
    if (!skillsRepo.has(skill)) continue;
    conferirFrontmatter("repo", join(repo, "skills", skill, "SKILL.md"), skill, valor, falha);
    const instalado = join(CLAUDE_HOME, "skills", skill, "SKILL.md");
    if (!fs.existsSync(instalado)) falha(skill, `instalação sem ${skill} — rode ./sync.sh push`);
    else conferirFrontmatter("instalação", instalado, skill, valor, falha);
  }

  const verdes = [...tabela].filter(([skill]) => skillsRepo.has(skill) && !comFalha.has(skill));
  return { falhas, verdes };
}

function main() {
  const args = lerArgs(process.argv.slice(2));
  if (!args) {
    console.error(USO);
    return 2;
  }
  const repo = args.repo ?? join(dirname(fileURLToPath(import.meta.url)), "..");

  const { falhas, verdes } = estatica(repo);
  for (const [skill, valor] of verdes) console.log(`ok  ${skill}  ${valor}`);
  if (falhas.length > 0) {
    for (const f of falhas) console.log(f);
    return 1;
  }
  console.log(`estática: ${verdes.length} ok`);

  if (args.viva) {
    console.log("FALHA: --viva ainda não tem parte viva neste script (task 3 do card #21)");
    return 1;
  }
  return 0;
}

// exitCode, e não process.exit: sair à força pode cortar a saída que ainda está no pipe.
process.exitCode = main();

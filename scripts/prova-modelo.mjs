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
//
// A parte viva abre, para cada modelo da tabela, uma sessão headless em auto mode noutro modelo e
// invoca uma skill real daquele modelo. Os porquês do desenho:
//
// - Spawn sempre sem shell, com array de argumentos. No Windows o `claude` do PATH é o shim do npm:
//   o Node recusa `.cmd` sem shell (EINVAL), e com shell do Git Bash a camada MSYS converte o `/`
//   do slash command em caminho (`/gm-card` chegava como `C:/Program Files/Git/gm-card`). Por isso o
//   executável é achado como no `claudeBin.ts` do Operations Center — BRAIN_CLAUDE_BIN, depois o
//   `.exe` atrás do shim — e a versão é conferida antes de gastar cota.
// - A prova é o evento `init` e o transcript, nunca o `modelUsage` do resultado: ele lista também a
//   Haiku que o Claude Code roda em segundo plano. Entradas `<synthetic>` não contam como resposta.
// - A sonda roda numa pasta vazia, sem CLAUDE.md, com as ferramentas de escrita bloqueadas, MCP
//   nenhum e hooks desligados: as skills de board param na falta do `## Board` antes de escrever, e
//   o bloqueio é a segunda camada. Skill carregada dentro da sonda a torna inconclusiva, e não
//   verde, porque o `attributionSkill` troca de dono.
// - Em planos que cobram o Fable de créditos de uso, a sonda do Fable cobra sem perguntar: em `-p`
//   não há quem consinta.
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import win32 from "node:path/win32";
import { fileURLToPath } from "node:url";

const USO = "uso: node scripts/prova-modelo.mjs [--viva] [--repo <dir>]";
const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), ".claude");
const SECAO = "## Qual modelo roda cada estação";
const IDS = ["claude-sonnet-5", "claude-opus-5", "claude-fable-5-1"];
const VERSAO_MINIMA = [2, 1, 257]; // o mínimo do Fable 5.1
// As que só leem ou param cedo vêm primeiro; gm-implement por último, porque cria branch e worktree.
const PREFERENCIA = [
  "gm-explore", "gm-triage", "gm-card", "gm-spec", "gm-prd", "gm-plan-tasks", "gm-correcao",
  "gm-ship", "gm-release", "gm-hotfix", "gm-implement",
];
const BLOQUEADAS = [
  "Bash", "PowerShell", "Write", "Edit", "NotebookEdit", "Agent", "EnterWorktree", "ExitWorktree",
  "CronCreate", "CronDelete", "RemoteTrigger", "Workflow",
];
const ARG = "sonda da prova-modelo (card #21): nao escreva nada, nao crie nada e nao invoque outras skills";

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

// BRAIN_CLAUDE_BIN apontando para o nada é FALHA, e não degrau pulado: quem a definiu queria aquele
// executável, e cair para outro provaria a versão errada. As linhas do `where` terminam em `\r\n` —
// sem o trim, o `.cmd\r` seria pulado e a cadeia cairia no 2.1.212 de ~/.local/bin.
function acharBin() {
  const env = (process.env.BRAIN_CLAUDE_BIN ?? "").trim();
  if (env !== "") {
    if (fs.existsSync(env)) return { bin: env };
    return { falha: `BRAIN_CLAUDE_BIN aponta para ${env}, que não existe.` };
  }
  if (process.platform !== "win32") return { bin: "claude" };

  let linhas = [];
  try {
    linhas = execFileSync("where", ["claude"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== "");
  } catch {
    linhas = [];
  }
  for (const linha of linhas) {
    const ext = win32.extname(linha).toLowerCase();
    if (ext === ".exe" && fs.existsSync(linha)) return { bin: linha };
    if (ext === ".cmd") {
      const exe = win32.join(win32.dirname(linha), "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
      if (fs.existsSync(exe)) return { bin: exe };
    }
  }
  const local = win32.join(os.homedir(), ".local", "bin", "claude.exe");
  if (fs.existsSync(local)) return { bin: local };
  return { falha: "Claude Code não encontrado — aponte BRAIN_CLAUDE_BIN para o executável." };
}

function conferirVersao(bin) {
  const r = spawnSync(bin, ["--version"], { encoding: "utf8" });
  const m = (r.stdout ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return { falha: `${bin} não informou versão` };
  const versao = m.slice(1, 4).map(Number);
  const texto = versao.join(".");
  for (let i = 0; i < 3; i++) {
    if (versao[i] > VERSAO_MINIMA[i]) break;
    if (versao[i] < VERSAO_MINIMA[i]) {
      return {
        falha: `${bin} é ${texto}; a prova exige Claude Code ≥ ${VERSAO_MINIMA.join(".")} — rode claude update ou aponte BRAIN_CLAUDE_BIN`,
      };
    }
  }
  return { versao: texto };
}

// Para cada id da tabela, na ordem em que aparece, a primeira skill de PREFERENCIA que o declara.
// A sessão abre noutro modelo, senão a prova não distingue o modelo da skill do da sessão.
function escolherSondas(tabela) {
  const sondas = [];
  const falhas = [];
  for (const declarado of new Set(tabela.map(([, valor]) => valor))) {
    if (!IDS.includes(declarado)) continue;
    const skill = PREFERENCIA.find((s) => tabela.some(([sk, v]) => sk === s && v === declarado));
    if (!skill) falhas.push(`FALHA: nenhuma skill sondável para ${declarado}`);
    else sondas.push({ skill, declarado, sessao: declarado === "claude-sonnet-5" ? "claude-opus-5" : "claude-sonnet-5" });
  }
  return { sondas, falhas };
}

function lerJsonl(texto) {
  const entradas = [];
  for (const linha of texto.split("\n")) {
    try {
      entradas.push(JSON.parse(linha));
    } catch {
      // linha que não é JSON não conta
    }
  }
  return entradas;
}

// O código de saída não é critério: `--max-turns` sai com erro ao atingir o limite. A rodada subiu
// se o processo existiu e emitiu o `init`.
function rodar(bin, args, cwd) {
  const r = spawnSync(bin, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 600000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const init = r.error
    ? undefined
    : lerJsonl((r.stdout ?? "").replace(/\r\n/g, "\n")).find((e) => e?.type === "system" && e?.subtype === "init");
  if (init) return { init };
  const motivo = r.error?.code ?? (r.stderr ?? "").replace(/\r\n/g, "\n").split("\n").slice(-20).join("\n");
  return { motivo };
}

function acharTranscript(sid) {
  const projetos = join(CLAUDE_HOME, "projects");
  if (!fs.existsSync(projetos)) return null;
  for (const d of fs.readdirSync(projetos, { withFileTypes: true })) {
    const arquivo = join(projetos, d.name, `${sid}.jsonl`);
    if (d.isDirectory() && fs.existsSync(arquivo)) return arquivo;
  }
  return null;
}

// Rodada 1 é o promptId do primeiro prompt; rodada 2, o primeiro promptId diferente. Cada mensagem
// do assistente pertence ao promptId do último `user` antes dela — a resposta a um tool_result
// continua no mesmo promptId, e é isso que deixa ver o modelo atravessando as ferramentas.
function separarRodadas(entradas) {
  const mensagens = new Map();
  const ferramentas = [];
  let p1;
  let p2;
  let atual;
  for (const e of entradas) {
    if (e?.type === "user" && e.promptId !== undefined) {
      atual = e.promptId;
      if (p1 === undefined) p1 = atual;
      else if (p2 === undefined && atual !== p1) p2 = atual;
    } else if (e?.type === "assistant") {
      const conteudo = Array.isArray(e.message?.content) ? e.message.content : [];
      for (const b of conteudo) if (b?.type === "tool_use") ferramentas.push(b.name);
      if (e.message?.model === "<synthetic>") continue;
      if (!mensagens.has(atual)) mensagens.set(atual, []);
      mensagens.get(atual).push(e);
    }
  }
  const de = (p) => (p === undefined ? [] : (mensagens.get(p) ?? []));
  return { skill: de(p1), livre: de(p2), ferramentas };
}

function conjunto(msgs) {
  return `{${[...new Set(msgs.map((m) => m.message?.model))].join(", ")}}`;
}

function sondar(bin, { skill, declarado, sessao }) {
  const falhas = [];
  const cwd = fs.mkdtempSync(join(os.tmpdir(), "prova-modelo-"));
  const sid = crypto.randomUUID();
  const comuns = [
    "--permission-mode", "auto", "--strict-mcp-config", "--settings", '{"disableAllHooks":true}',
    "--disallowedTools", BLOQUEADAS.join(","), "--output-format", "stream-json", "--verbose",
  ];
  let transcript = null;
  try {
    const conferirInit = (n, rodada, esperado) => {
      if (!rodada.init) {
        falhas.push(`FALHA: ${skill} rodada ${n} não subiu: ${rodada.motivo}`);
        return false;
      }
      if (rodada.init.permissionMode !== "auto") {
        falhas.push(`FALHA: ${skill} rodada ${n} sem auto mode (${rodada.init.permissionMode}) — a prova do CA2 não vale fora dele`);
      }
      const modelo = String(rodada.init.model ?? "").replace(/\[1m\]$/, "");
      if (modelo !== esperado) falhas.push(`FALHA: ${skill} rodada ${n} init em ${modelo}, esperado ${esperado}`);
      return true;
    };

    const r1 = rodar(bin, ["-p", `/${skill} ${ARG}`, "--model", sessao, "--session-id", sid, "--max-turns", "2", ...comuns], cwd);
    let subiu2 = false;
    if (conferirInit(1, r1, declarado)) {
      const r2 = rodar(bin, ["-p", "responda apenas: ok", "--resume", sid, "--model", sessao, "--max-turns", "1", ...comuns], cwd);
      subiu2 = conferirInit(2, r2, sessao);
    }

    let rodadas = { skill: [], livre: [] };
    if (r1.init) {
      transcript = acharTranscript(sid);
      if (!transcript) falhas.push(`FALHA: ${skill} sem transcript ${sid}.jsonl`);
      else {
        rodadas = separarRodadas(lerJsonl(ler(transcript)));
        const msgs = rodadas.skill;
        if (msgs.length === 0) falhas.push(`FALHA: ${skill} rodada 1 sem resposta do assistente`);
        else if (msgs[0].attributionSkill !== skill) {
          falhas.push(`FALHA: ${skill} rodada 1 começou atribuída a ${msgs[0].attributionSkill ?? "nenhuma skill"}`);
        }
        for (const m of msgs) {
          if (m.message?.model !== declarado) {
            falhas.push(`FALHA: ${skill} rodada 1 respondeu em ${m.message?.model}, esperado ${declarado}`);
          }
        }
        for (const outra of new Set(msgs.map((m) => m.attributionSkill))) {
          if (outra !== undefined && outra !== skill) falhas.push(`FALHA: ${skill} rodada 1 carregou a skill ${outra} — sonda inconclusiva`);
        }
        if (subiu2) {
          if (rodadas.livre.length === 0) falhas.push(`FALHA: ${skill} rodada 2 sem resposta do assistente`);
          for (const m of rodadas.livre) {
            if (m.message?.model !== sessao) {
              falhas.push(`FALHA: ${skill} rodada 2 respondeu em ${m.message?.model}, esperado ${sessao}`);
            }
            if (m.attributionSkill !== undefined) falhas.push(`FALHA: ${skill} rodada 2 atribuída a ${m.attributionSkill}`);
          }
        }
        for (const nome of new Set(rodadas.ferramentas)) {
          if (BLOQUEADAS.includes(nome)) falhas.push(`FALHA: ${skill} chamou ${nome}, que devia estar bloqueada`);
        }
      }
    }

    console.log(
      `${skill}  declarado ${declarado}  sessão ${sessao}  init ${r1.init?.permissionMode ?? "—"}  ` +
        `skill: ${rodadas.skill.length} msgs em ${conjunto(rodadas.skill)}  ` +
        `livre: ${rodadas.livre.length} msgs em ${conjunto(rodadas.livre)}  ${falhas.length === 0 ? "ok" : "FALHA"}`,
    );
  } finally {
    // A pasta do transcript só sai se o nome dela vier do cwd desta sonda: nenhuma outra pasta de
    // ~/.claude/projects é apagada, nunca.
    const alvos = [cwd];
    const pastaTranscript = transcript ? dirname(transcript) : null;
    if (pastaTranscript && basename(pastaTranscript).endsWith(basename(cwd).replace(/[^A-Za-z0-9]/g, "-"))) {
      alvos.push(pastaTranscript);
    }
    for (const alvo of alvos) {
      try {
        fs.rmSync(alvo, { recursive: true, force: true });
        console.log(`apaguei ${alvo}`);
      } catch (e) {
        console.log(`aviso: não apaguei ${alvo}: ${e.message}`);
      }
    }
  }
  return falhas;
}

function viva(tabela) {
  const achado = acharBin();
  if (achado.falha) {
    console.log(`FALHA: ${achado.falha}`);
    return 1;
  }
  const versao = conferirVersao(achado.bin);
  if (versao.falha) {
    console.log(`FALHA: ${versao.falha}`);
    return 1;
  }
  console.log(`bin: ${achado.bin} (${versao.versao})`);

  const { sondas, falhas } = escolherSondas(tabela);
  let verdes = 0;
  for (const sonda of sondas) {
    const f = sondar(achado.bin, sonda);
    if (f.length === 0) verdes++;
    falhas.push(...f);
  }
  if (falhas.length > 0) {
    for (const f of falhas) console.log(f);
    return 1;
  }
  console.log(`viva: ${verdes} ok`);
  return 0;
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

  return args.viva ? viva(verdes) : 0;
}

// exitCode, e não process.exit: sair à força pode cortar a saída que ainda está no pipe.
process.exitCode = main();

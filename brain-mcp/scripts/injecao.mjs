// Replay do corpus local de prompts contra o hook de contexto: mede a taxa de injeção ANTES e
// DEPOIS da mudança, sobre o MESMO corpus, e serve de lupa para um prompt avulso.
//
//   node scripts/injecao.mjs [--dias N | --desde YYYY-MM-DD --ate YYYY-MM-DD] [--base <ref>]
//   node scripts/injecao.mjs --caso "<prompt>" [--cwd <path>]
//   node scripts/injecao.mjs --desde YYYY-MM-DD --ate YYYY-MM-DD --base <ref> --portao jev
//
// `--portao <ca2|jev>` (padrao `ca2`) escolhe o portao de saida. `ca2` e o de sempre (taxa de
// injecao). `jev` e o do #42: (a) com a flag do Jev desligada o hook novo emite a MESMA stdout do
// base em todo o corpus, e (b) com o cliente falso em modo oraculo o filtro preserva o que o base
// injetava de esperado e so deixa passar esperado. Exige --desde, --ate e --base explicitos.
// Codigos do `jev`: 0 passou, 1 reprovou, 2 nao medi. `--portao` nao vale com `--caso`.
//
// A SAIDA DESTE SCRIPT NAO VAI PARA PR NEM CARD, salvo as linhas de contagem: o corpus traz
// conteudo dos dois workspaces e o repo e publico. O modo `jev` so imprime contagens e indices.
//
// Por que antes-e-depois no mesmo corpus, e não contra um número fixo: a janela de `--dias` muda
// todo dia, então um limiar fixo mediria a mistura de trabalho da semana, não o efeito da
// mudança. `--desde/--ate` fixam datas absolutas e são o que torna uma medição repetível meses
// depois.
//
// RODE `--caso` NO POWERSHELL, não no Git Bash. A camada MSYS converte argumento que parece
// caminho POSIX: `--caso "/gm-spec #11"` chega ao script como "C:/Program Files/Git/gm-spec #11",
// que não começa com `/`, passa o guard de slash e INJETA — um falso positivo que parece o hook
// novo funcionando antes de existir. Medido nesta sessão; `MSYS_NO_PATHCONV=1` não resolveu.
//
// O script EXECUTA O HOOK DE VERDADE, um spawn por prompt, com o JSON do UserPromptSubmit na
// stdin — mesmo padrão do smoke.mjs, que sobe o servidor real em vez de importar as funções.
// Reimplementar a lógica do hook aqui passaria a mentir no dia em que o hook mudasse, e é
// justamente essa mudança que este script existe para pegar. Injetou = stdout não-vazia com
// hookSpecificOutput, e nada mais.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), ".."); // brain-mcp/
const repo = join(root, ".."); // raiz do repo
const require = createRequire(import.meta.url);
const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || join(os.homedir(), ".claude");
const DEBUG = !!process.env.BRAIN_HOOK_DEBUG;

// Quantos spawns em paralelo. Cada um paga startup do node + abertura de um db de 150 MB + a
// busca léxica. Medido nesta máquina sobre os mesmos 214 prompts: serial 15 s, com 6 em paralelo
// 6 s (e a rodada de 660 prompts de `--dias 3` sai em 13 s). As duas rodadas deram a MESMA taxa
// (48/214), que é o que mostra que o paralelismo não distorce o número — o openDb tem
// busy_timeout de 5 s e a disputa pelo lock não apareceu.
const PARALELO = 6;
const TIMEOUT_HOOK = 30000; // o harness dá 10 s ao hook; aqui é só rede contra travar a rodada

const PISO_DEPOIS = 60; // CA-2: taxa depois >= 60%...
const FATOR = 2; //        ...e pelo menos o dobro da taxa antes

function fail(msg) {
  console.error("FALHOU: " + msg);
  process.exit(1);
}

// ---------------------------------------------------------------- argumentos

const argv = process.argv.slice(2);
const valor = (nome) => {
  const i = argv.indexOf("--" + nome);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) fail(`--${nome} espera um valor`);
  return v;
};
const til = (p) => (p && p.startsWith("~") ? join(os.homedir(), p.slice(1)) : p);

const caso = valor("caso");
// PowerShell não expande `~` em argumento de executável nativo, e as verificações da spec são
// escritas com `--cwd ~/pessoal/claude-brain`. Expandir aqui evita um "não injetou" que na
// verdade é só caminho inexistente.
const cwdCaso = til(valor("cwd")) || process.cwd();
const baseRef = valor("base") ?? "dev";
const argDias = valor("dias");
const argDesde = valor("desde");
const argAte = valor("ate");
const argBase = valor("base");
const portao = valor("portao") ?? "ca2";
if (portao !== "ca2" && portao !== "jev") fail(`--portao desconhecido: ${portao} (esperado ca2 ou jev)`);
if (portao !== "ca2" && caso !== undefined) fail("--portao não vale com --caso");

// Exit 2 do portão `jev`: a medição não aconteceu, o que é diferente de reprovar.
function naoMedi(motivo) {
  console.error("NÃO MEDI: " + motivo);
  process.exit(2);
}
if (portao === "jev" && (argDesde === undefined || argAte === undefined || argBase === undefined)) {
  naoMedi("o portão do #42 é sobre janela e base fixas: passe --desde, --ate e --base");
}

// ---------------------------------------------------------------- pré-voo do ambiente
//
// Tudo aqui é falha de ambiente, não veredito de medição: taxa zero por falta de config é
// indistinguível de regressão, e é esse silêncio que o pré-voo existe para quebrar. Por isso ele
// roda também no modo `--caso` — o que `--caso` nunca faz é reprovar por limiar (o portão do
// CA-2, no fim do arquivo).

const cfgPath = join(repo, "hooks", "brain-config.js");
if (!fs.existsSync(cfgPath)) fail(`não achei ${cfgPath} — este script roda de dentro do repo`);
const cfg = require(cfgPath);

const jevPath = join(repo, "hooks", "jev.js");
if (!fs.existsSync(jevPath)) fail(`não achei ${jevPath} — este script roda de dentro do repo`);
const jev = require(jevPath);

const conf = cfg.carregar();
if (!conf) {
  fail(
    `sem lista de workspaces utilizável em ${cfg.ARQUIVO}\n` +
      "  (arquivo ausente, JSON inválido ou `workspaces` vazio — sem ela o hook não acha o índice)"
  );
}
if (!conf.db || !fs.existsSync(conf.db)) {
  fail(`índice não encontrado: ${conf.db || "(chave `db` ausente no brain-workspaces.json)"}`);
}

// O dist/ que o hook importa é o da INSTALAÇÃO, não o do repo: o hook o deriva de
// dirname(ws.db)/../dist. Rodar este script dentro do repo não usa o dist/ do repo, e não deve —
// é o mesmo dist/ que o hook de verdade usa em produção.
const dist = join(dirname(conf.db), "..", "dist");
for (const m of ["db.js", "search.js"]) {
  if (!fs.existsSync(join(dist, m))) {
    fail(`${join(dist, m)} não existe — rode \`npm run build\` NA INSTALAÇÃO (${join(dist, "..")})`);
  }
}
// dist/ velho é a falha que nada avisa: o `sync push` copia o src/, e sem build o que roda
// continua sendo o js antigo. Aqui ela avisa.
const srcInst = join(dist, "..", "src");
const maisNovo = (dir, ext) => {
  const ms = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => fs.statSync(join(dir, f)).mtimeMs);
  return ms.length ? Math.max(...ms) : 0;
};
if (fs.existsSync(srcInst)) {
  const ts = maisNovo(srcInst, ".ts");
  const js = maisNovo(dist, ".js");
  if (ts > js) {
    fail(
      `dist/ está mais velho que src/ na instalação (${join(dist, "..")})\n` +
        `  src/ mais recente:  ${new Date(ts).toISOString()}\n` +
        `  dist/ mais recente: ${new Date(js).toISOString()}\n` +
        "  rode `npm run build` lá — é o dist/ que o hook carrega"
    );
  }
}

const hookDepois = join(repo, "hooks", "brain-contexto.js");
if (!fs.existsSync(hookDepois)) fail(`não achei ${hookDepois}`);

// ---------------------------------------------------------------- execução do hook

const blocoDe = (saida) => {
  const s = saida.trim();
  if (!s || !s.includes("hookSpecificOutput")) return null;
  try {
    const j = JSON.parse(s);
    return (j.hookSpecificOutput && j.hookSpecificOutput.additionalContext) || null;
  } catch {
    return null;
  }
};

// O `env` do filho é sempre explícito. Todo filho sai de `jev.envSemJev(process.env)`: sem a chave
// da API e sem `BRAIN_JEV*`. É isto que mantém "a medição não usa rede" verdadeiro numa máquina que
// um dia tiver `TYPESAFE_API_KEY` no ambiente: o hook e o cliente herdariam a chave e o corpus iria
// para fora. Quem quer o cliente falso o repõe por cima, sem nunca repor a chave.
const envLimpo = () => jev.envSemJev(process.env);

function rodar(hookPath, prompt, cwd, env = envLimpo()) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [hookPath], {
      stdio: ["pipe", "pipe", DEBUG ? "inherit" : "ignore"],
      env,
    });
    let saida = "";
    let pronto = false;
    const encerra = (r) => {
      if (pronto) return;
      pronto = true;
      clearTimeout(t);
      resolve(r);
    };
    const t = setTimeout(() => {
      p.kill();
      encerra({ bloco: null, saida: "", timeout: true });
    }, TIMEOUT_HOOK);
    p.stdout.on("data", (d) => {
      saida += d;
    });
    p.on("error", () => encerra({ bloco: null, saida: "", erro: true }));
    p.on("close", () => encerra({ bloco: blocoDe(saida), saida }));
    p.stdin.on("error", () => {}); // hook que sai antes de ler a stdin fecha o pipe; não é erro
    p.stdin.end(JSON.stringify({ prompt, cwd }));
  });
}

async function emLote(itens, tarefa, rotulo) {
  const res = new Array(itens.length);
  let prox = 0;
  let feitos = 0;
  const tty = process.stderr.isTTY;
  const trabalhadores = Array.from({ length: Math.min(PARALELO, itens.length) }, async () => {
    for (;;) {
      const i = prox++;
      if (i >= itens.length) return;
      res[i] = await tarefa(itens[i]);
      feitos++;
      // progresso na stderr: a stdout é o relatório, e quem a redireciona quer só ele
      if (tty && feitos % 20 === 0) process.stderr.write(`\r${rotulo}: ${feitos}/${itens.length}   `);
    }
  });
  await Promise.all(trabalhadores);
  if (tty) process.stderr.write("\r" + " ".repeat(40) + "\r");
  return res;
}

// ---------------------------------------------------------------- modo --caso
//
// Ferramenta de inspeção: imprime o bloco injetado e nada mais. Não injetou, não imprime nada —
// é o que faz `--caso "ok"` sair em silêncio e o que deixa a saída comparável byte a byte entre
// rodadas. Nunca reprova por limiar.

if (caso !== undefined) {
  // O --caso inspeciona o filtro com o cliente falso e nunca com o real: repõe só as três variáveis
  // do Jev como vieram, e a chave não passa.
  const envCaso = envLimpo();
  for (const nome of ["BRAIN_JEV", "BRAIN_JEV_FALSO", "BRAIN_JEV_LIMIAR_CONTEXTO"]) {
    if (process.env[nome] !== undefined) envCaso[nome] = process.env[nome];
  }
  const r = await rodar(hookDepois, caso, cwdCaso, envCaso);
  if (r.timeout) console.error(`(o hook estourou ${TIMEOUT_HOOK / 1000}s)`);
  if (r.bloco) process.stdout.write(r.bloco + "\n");
  process.exit(0);
}

// ---------------------------------------------------------------- janela

function janela() {
  if (argDesde !== undefined) {
    const de = new Date(argDesde + "T00:00:00");
    const ate = argAte !== undefined ? new Date(argAte + "T23:59:59.999") : new Date();
    if (isNaN(de.getTime()) || isNaN(ate.getTime())) fail("--desde/--ate esperam YYYY-MM-DD");
    if (de.getTime() > ate.getTime()) fail("--desde é depois de --ate");
    return { de: de.getTime(), ate: ate.getTime(), rotulo: `${argDesde} → ${argAte ?? "agora"}` };
  }
  if (argAte !== undefined) fail("--ate só faz sentido com --desde");
  const dias = Number(argDias ?? 3);
  if (!Number.isFinite(dias) || dias <= 0) fail("--dias espera um número > 0");
  const agora = Date.now();
  return { de: agora - dias * 86400000, ate: agora, rotulo: `últimos ${dias} dias` };
}

// ---------------------------------------------------------------- corpus

const RE_NOME = /<command-name>([^<]*)<\/command-name>/;
const RE_ARGS = /<command-args>([^<]*)<\/command-args>/;

const textoDo = (e) => {
  const c = e.message && e.message.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .filter((x) => x && x.type === "text")
      .map((x) => x.text || "")
      .join("");
  }
  return "";
};

function coletar(j) {
  const base = join(CLAUDE_HOME, "projects");
  if (!fs.existsSync(base)) fail(`não achei os transcripts em ${base}`);

  const prompts = [];
  let arquivos = 0;
  let comPrompt = 0;
  let foraDeWs = 0;

  for (const d of fs.readdirSync(base)) {
    let lista;
    try {
      lista = fs.readdirSync(join(base, d)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue; // pasta ilegível não é motivo para derrubar a medição
    }
    for (const f of lista) {
      arquivos++;
      let linhas;
      try {
        linhas = fs.readFileSync(join(base, d, f), "utf8").split("\n");
      } catch {
        continue;
      }
      let rendeu = false;
      for (const linha of linhas) {
        if (!linha) continue;
        let e;
        try {
          e = JSON.parse(linha);
        } catch {
          continue;
        }
        if (e.type !== "user" || e.isMeta) continue;
        const ts = Date.parse(e.timestamp || "");
        if (!Number.isFinite(ts) || ts < j.de || ts > j.ate) continue;

        let t = textoDo(e).trim();
        if (!t) continue;

        // ORDEM IMPORTA. Slash command chega ao transcript já EXPANDIDO (<command-name> +
        // <command-args>, e o corpo da skill num evento isMeta à parte), então o texto começa
        // com `<`. Reconstituir a linha crua ANTES do descarte por `<` é o que impede jogar fora
        // 45% da população que o CA-2 mede — o que o harness manda ao hook é a linha crua.
        const nome = t.match(RE_NOME);
        if (nome) {
          const args = t.match(RE_ARGS);
          t = (nome[1].trim() + " " + ((args && args[1]) || "").trim()).trim();
          if (!t.startsWith("/")) continue;
        } else if (t.startsWith("<") || t.startsWith("Caveat:")) {
          continue; // system-reminder, task-notification, saída de bash: não é gente digitando
        }

        // Filtro de cwd: a regra é a do doCwd, não uma lista de nomes. Descarta os fixtures e os
        // scratchpads de AppData/Local/Temp porque moram fora do prefixo de qualquer workspace —
        // e o existsSync descarta worktree que já foi apagada.
        const cwd = e.cwd || "";
        if (!cfg.doCwd(cwd) || !fs.existsSync(cwd)) {
          foraDeWs++;
          continue;
        }

        prompts.push({ prompt: t, cwd });
        rendeu = true;
      }
      if (rendeu) comPrompt++;
    }
  }
  return { prompts, arquivos, comPrompt, foraDeWs };
}

// ---------------------------------------------------------------- motivos
//
// Os buckets partem a população por FORMA do prompt, e só são consultados para prompt que o hook
// de verdade NÃO injetou — o numerador nunca vem daqui, vem sempre da stdout do hook. É o que
// permite reportar a repartição sem duplicar a lógica do hook: os predicados são disjuntos e
// independentes de qual variante rodou, então as duas colunas são comparáveis.
//
// Consequência a declarar, porque o hook de referência tem os guards na ordem inversa: slash
// command com <12 chars (`/gm-card #5` tem 11) cai em `slash` nas duas colunas, embora no hook
// de referência quem o mate seja o guard de tamanho. O rodapé do relatório dá esse número.

const MOTIVOS = [
  ["entidade", "injetou pela entidade resolvida no grafo"],
  ["texto", "injetou pela busca léxica"],
  ["slash", "slash command com argumento, não injetou"],
  ["semArg", "slash command sem argumento (/clear, /diario)"],
  ["curto", "prompt normal com <12 chars"],
  ["relevancia", "passou os guards, nada sobreviveu aos filtros"],
  ["semWs", "cwd fora de workspace ou índice ausente"],
];

const argDe = (p) => {
  const m = p.match(/^\/\S+\s*([\s\S]*)$/);
  return m ? m[1].trim() : "";
};

function motivo(p, bloco) {
  // O cabeçalho léxico é o que existe hoje e cuja frase o caminho de entidade não reusa; qualquer
  // outro bloco veio da resolução de entidade.
  if (bloco) return /busca lexica automatica/.test(bloco) ? "texto" : "entidade";
  if (!cfg.doCwd(p.cwd)) return "semWs";
  if (p.prompt.startsWith("/")) return argDe(p.prompt) ? "slash" : "semArg";
  if (p.prompt.length < 12) return "curto";
  return "relevancia";
}

// ---------------------------------------------------------------- hook de referência

function resolverBase() {
  const doGit = (arquivo) => {
    try {
      return execFileSync("git", ["show", `${baseRef}:hooks/${arquivo}`], {
        cwd: repo,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  };

  const daRef = doGit("brain-contexto.js");
  if (daRef !== null) {
    // O hook faz require('./brain-config.js'), relativo ao próprio arquivo: o temp precisa dos
    // dois lado a lado. O brain-config vem da mesma ref, para a referência ser inteira dela.
    const dir = fs.mkdtempSync(join(os.tmpdir(), "injecao-base-"));
    fs.writeFileSync(join(dir, "brain-contexto.js"), daRef);
    fs.writeFileSync(join(dir, "brain-config.js"), doGit("brain-config.js") ?? fs.readFileSync(cfgPath, "utf8"));
    return {
      path: join(dir, "brain-contexto.js"),
      fonte: `git show ${baseRef}:hooks/brain-contexto.js`,
      texto: daRef,
      tmp: dir,
      nota: null,
    };
  }

  // A ref não tem o arquivo — é o caso da execução que fecha o CA-2, porque é este card que o
  // versiona. O "antes" passa a ser o hook da instalação, que é o que roda hoje de verdade.
  const inst = join(CLAUDE_HOME, "hooks", "brain-contexto.js");
  if (!fs.existsSync(inst)) return null;
  return {
    path: inst,
    fonte: inst,
    texto: fs.readFileSync(inst, "utf8"),
    tmp: null,
    nota: `a ref \`${baseRef}\` não tem hooks/brain-contexto.js — é este card que o versiona`,
  };
}

// ---------------------------------------------------------------- portão `jev` (#42)
//
// Declarada como função (hoisted) porque usa o que está definido acima; só é chamada depois de
// `base` e `compara` existirem. Sai com 0/1/2 por conta própria.

class NaoMedi extends Error {}
const naoMediAqui = (motivo) => {
  throw new NaoMedi(motivo);
};

async function portaoJev() {
  let codigo;
  try {
    codigo = await medirPortaoJev();
  } catch (e) {
    if (!(e instanceof NaoMedi)) throw e;
    console.error("NÃO MEDI: " + e.message);
    codigo = 2;
  } finally {
    // O temporário do base vive até aqui porque o golden também roda o base (hoje o ca2 o apaga
    // logo depois do corpus).
    if (base && base.tmp) fs.rmSync(base.tmp, { recursive: true, force: true });
  }
  process.exit(codigo);
}

async function medirPortaoJev() {
  {
    if (!base) naoMediAqui("não há hook de referência (--base) para comparar");
    if (!compara) naoMediAqui("o hook é igual ao base: não há o que o portão do #42 medir");
    let reprovou = false;

    // (a) Corpus: flag desligada, base e worktree um seguido do outro. O índice vivo muda durante
    // a rodada (o Vigia do servidor escreve nele), então só conta a divergência que se repete.
    const par = async (p) => {
      const b = await rodar(base.path, p.prompt, p.cwd);
      const w = await rodar(hookDepois, p.prompt, p.cwd);
      return { b, w };
    };
    const diverge = ({ b, w }) => semCr(b.saida) !== semCr(w.saida);
    const falhou = ({ b, w }) => !!(b.timeout || b.erro || w.timeout || w.erro);

    const pares = await emLote(prompts, par, "corpus");
    const repetidos = new Map();
    for (let i = 0; i < pares.length; i++) {
      if (falhou(pares[i])) naoMediAqui(`timeout ou erro ao rodar o hook no prompt de índice ${i}`);
      if (diverge(pares[i])) repetidos.set(i, await par(prompts[i]));
    }
    const divergentes = [];
    for (const [i, segundo] of repetidos) {
      if (falhou(segundo)) naoMediAqui(`timeout ou erro ao repetir o prompt de índice ${i}`);
      if (diverge(segundo)) divergentes.push(i);
    }
    const cB = conta(pares.map((x) => x.b));
    const cW = conta(pares.map((x) => x.w));
    console.log(`Janela: ${j.rotulo} · ${prompts.length} prompts humanos`);
    console.log(`Taxa de injeção — base:  ${cB.inj}/${prompts.length} = ${cB.taxa.toFixed(1)}%`);
    console.log(`Taxa de injeção — árvore: ${cW.inj}/${prompts.length} = ${cW.taxa.toFixed(1)}%`);
    console.log(`Divergências na primeira passada: ${repetidos.size}, repetidas depois: ${divergentes.length}`);
    console.log(`Saídas diferentes com a flag desligada: ${divergentes.length}`);
    if (divergentes.length) {
      console.log(`  índices (no máximo 10): ${divergentes.slice(0, 10).join(", ")}`);
      reprovou = true;
    }

    // (b) Golden com o cliente falso em modo oráculo, nos dois workspaces.
    const golden = JSON.parse(fs.readFileSync(process.env.BRAIN_GOLDEN || join(root, "scripts", "golden.json"), "utf8"));
    const tmpRoteiro = fs.mkdtempSync(join(os.tmpdir(), "injecao-oraculo-"));
    try {
      const alvosDe = (c) => [].concat(c.esperado ?? []).map((a) => norm(String(a)));
      const regras = [];
      const norm = (t) => String(t).toLowerCase().replace(/\\/g, "/"); // a `norm` do eval.mjs
      for (const c of golden) {
        if (c.tipo === "negativo") continue;
        for (const alvo of alvosDe(c)) {
          regras.push({ quando: { pergunta: c.q, trechoId: alvo }, responde: { probabilidade: 0.95 } });
        }
      }
      const roteiro = join(tmpRoteiro, "roteiro.json");
      fs.writeFileSync(roteiro, JSON.stringify({ regras, padrao: { probabilidade: 0.05 } }));

      const envDepois = { ...envLimpo(), BRAIN_JEV: "contexto", BRAIN_JEV_FALSO: roteiro };
      const prefixos = (conf.workspaces || []).map((w) => w.prefixo).filter((d) => d && fs.existsSync(d));
      if (!prefixos.length) naoMediAqui("nenhum prefixo de workspace existente para rodar o golden");

      // O caminho de cada slot é a linha logo depois da linha de meta (`N. título` / `[meta]` / caminho).
      const caminhosDe = (bloco) => {
        if (!bloco) return [];
        const ls = bloco.split("\n");
        const out = [];
        ls.forEach((l, i) => {
          if (/^\d+\. /.test(l) && ls[i + 2] !== undefined) out.push(norm(ls[i + 2].trim()));
        });
        return out;
      };
      const casa = (caminho, alvos) => alvos.some((a) => caminho.includes(a));
      const parGolden = async (c, cwd) => {
        const A = await rodar(base.path, c.q, cwd);
        const D = await rodar(hookDepois, c.q, cwd, envDepois);
        return { A, D };
      };
      const perdeu = (c, { A, D }) => {
        const alvos = alvosDe(c);
        const emD = new Set(caminhosDe(D.bloco));
        return caminhosDe(A.bloco).some((p) => casa(p, alvos) && !emD.has(p));
      };

      const tarefas = [];
      golden.forEach((c, indice) => prefixos.forEach((cwd, w) => tarefas.push({ c, indice, cwd, w })));
      const execs = await emLote(
        tarefas,
        async (t) => {
          let r = await parGolden(t.c, t.cwd);
          // Violação do (b1) na primeira passada repete o par antes de contar (índice vivo muda).
          if (t.c.tipo !== "negativo" && !r.A.timeout && !r.D.timeout && perdeu(t.c, r)) r = await parGolden(t.c, t.cwd);
          return { ...t, ...r };
        },
        "golden"
      );

      let blocosA = 0;
      let blocosD = 0;
      let slotsA = 0;
      let slotsAok = 0;
      let slotsD = 0;
      let slotsDok = 0;
      let preservados = 0;
      let esperadosEmA = 0;
      let negativos = 0;
      let negVaziosA = 0;
      let negVaziosD = 0;
      const violacoesB1 = [];
      const violacoesB2 = [];
      for (const e of execs) {
        if (e.A.timeout || e.A.erro || e.D.timeout || e.D.erro) {
          naoMediAqui(`timeout ou erro no caso ${e.indice} do golden (workspace ${e.w})`);
        }
        if (e.A.bloco) blocosA++;
        if (e.D.bloco) blocosD++;
        if (e.c.tipo === "negativo") {
          negativos++;
          if (!e.A.bloco) negVaziosA++;
          if (!e.D.bloco) negVaziosD++;
          else violacoesB2.push(`caso ${e.indice} (workspace ${e.w}): negativo com bloco`);
          continue;
        }
        const alvos = alvosDe(e.c);
        const pA = caminhosDe(e.A.bloco);
        const pD = caminhosDe(e.D.bloco);
        slotsA += pA.length;
        slotsAok += pA.filter((p) => casa(p, alvos)).length;
        slotsD += pD.length;
        slotsDok += pD.filter((p) => casa(p, alvos)).length;
        // (b1): todo esperado que o base injeta continua no bloco filtrado.
        const esperadosA = pA.filter((p) => casa(p, alvos));
        esperadosEmA += esperadosA.length;
        const perdidos = esperadosA.filter((p) => !pD.includes(p));
        preservados += esperadosA.length - perdidos.length;
        if (perdidos.length) violacoesB1.push(`caso ${e.indice} (workspace ${e.w}): ${perdidos.length} perdido(s)`);
        // (b2): com precisão de 2,0% hoje (P6), o oráculo prova o ENCANAMENTO (só entra o que o
        // cliente aprovou), e não a qualidade do Jev.
        const intrusos = pD.filter((p) => !casa(p, alvos));
        if (intrusos.length) violacoesB2.push(`caso ${e.indice} (workspace ${e.w}): ${intrusos.length} slot(s) não esperado(s)`);
      }
      const pct = (x, y) => (y ? `${((x / y) * 100).toFixed(1)}%` : "n/a");
      console.log(`\nGolden: ${execs.length} execuções (${golden.length} casos × ${prefixos.length} workspaces)`);
      console.log(`Blocos antes/depois: ${blocosA}/${blocosD}`);
      console.log(`Precisão antes ${slotsAok}/${slotsA} = ${pct(slotsAok, slotsA)}`);
      console.log(`Precisão depois ${slotsDok}/${slotsD} = ${pct(slotsDok, slotsD)}`);
      console.log(`Preservados ${preservados}/${esperadosEmA}`);
      console.log(`Negativos vazios antes/depois: ${negVaziosA}/${negVaziosD} de ${negativos}`);
      if (esperadosEmA === 0) naoMediAqui("nenhum esperado no bloco do base: o (b1) não provou nada");
      for (const v of [...violacoesB1.slice(0, 10).map((v) => "(b1) " + v), ...violacoesB2.slice(0, 10).map((v) => "(b2) " + v)]) {
        console.log("  " + v);
      }
      if (violacoesB1.length || violacoesB2.length) reprovou = true;
    } finally {
      fs.rmSync(tmpRoteiro, { recursive: true, force: true });
    }

    if (reprovou) {
      console.error("FALHOU: portão do #42 reprovado");
      return 1;
    }
    console.log("\nPortão do #42 OK");
    return 0;
  }
}

// ---------------------------------------------------------------- aferição

const j = janela();
const { prompts, arquivos, comPrompt, foraDeWs } = coletar(j);
if (!prompts.length) {
  fail(
    `corpus vazio na janela (${j.rotulo}) — ${arquivos} transcripts varridos, ${foraDeWs} prompts fora do filtro de cwd\n` +
      "  corpus vazio é indistinguível de extração quebrada; alargue a janela ou confira o brain-workspaces.json"
  );
}

const base = resolverBase();
const semCr = (s) => s.replace(/\r/g, "");
const iguais = base ? semCr(base.texto) === semCr(fs.readFileSync(hookDepois, "utf8")) : false;
const compara = !!base && !iguais;

if (portao === "jev") await portaoJev();

const depois = await emLote(prompts, (p) => rodar(hookDepois, p.prompt, p.cwd), "depois");
const antes = compara ? await emLote(prompts, (p) => rodar(base.path, p.prompt, p.cwd), "antes") : null;
if (base && base.tmp) fs.rmSync(base.tmp, { recursive: true, force: true });

function conta(res) {
  const m = new Map(MOTIVOS.map(([k]) => [k, 0]));
  let inj = 0;
  let timeouts = 0;
  let erros = 0;
  res.forEach((r, i) => {
    if (r.timeout) timeouts++;
    if (r.erro) erros++;
    if (r.bloco) inj++;
    const k = motivo(prompts[i], r.bloco);
    m.set(k, m.get(k) + 1);
  });
  return { m, inj, timeouts, erros, taxa: (inj / res.length) * 100 };
}

const cD = conta(depois);
const cA = antes ? conta(antes) : null;
const pc = (n) => `${((n / prompts.length) * 100).toFixed(1)}%`;

console.log(`Janela: ${j.rotulo} · ${arquivos} transcripts varridos, ${comPrompt} com prompt na janela`);
console.log(`Corpus: ${prompts.length} prompts humanos · ${foraDeWs} descartados pelo filtro de cwd\n`);

console.log("Hook medido (depois):  hooks/brain-contexto.js (árvore de trabalho)");
console.log(`Hook de referência:    ${base ? base.fonte : "(nenhum — sem base para comparar)"}`);
if (base && base.nota) console.log(`                       ${base.nota}`);
if (base && iguais) {
  console.log(
    "Os dois são byte a byte iguais: 'antes' e 'depois' medem o mesmo hook, então só a taxa\n" +
      "absoluta significa algo e o portão do CA-2 não se aplica. Rodada única."
  );
}
console.log("");

if (cA) {
  console.log(`Taxa de injeção — antes:  ${cA.inj}/${prompts.length} = ${cA.taxa.toFixed(1)}%`);
  console.log(`Taxa de injeção — depois: ${cD.inj}/${prompts.length} = ${cD.taxa.toFixed(1)}%`);
} else {
  console.log(`Taxa de injeção: ${cD.inj}/${prompts.length} = ${cD.taxa.toFixed(1)}%`);
}

console.log("\nRepartição por motivo:");
console.log(cA ? "  motivo         antes           depois" : "  motivo         prompts");
for (const [k, desc] of MOTIVOS) {
  const d = `${String(cD.m.get(k)).padStart(5)} ${pc(cD.m.get(k)).padStart(6)}`;
  const a = cA ? `${String(cA.m.get(k)).padStart(5)} ${pc(cA.m.get(k)).padStart(6)}    ` : "";
  console.log(`  ${k.padEnd(12)} ${a}${d}   ${desc}`);
}

const curtoSlash = prompts.filter((p) => p.prompt.startsWith("/") && argDe(p.prompt) && p.prompt.length < 12).length;
if (curtoSlash) {
  console.log(
    `\nNota: ${curtoSlash} prompts são slash command com argumento e <12 chars, contados em \`slash\`.` +
      "\nNo hook de referência o guard de tamanho vem antes, e são eles que a task 4 recupera."
  );
}
// Spawn que estourou ou nem subiu conta como não-injetado e derrubaria a taxa em silêncio — que é
// o mesmo modo de falhar que o pré-voo existe para quebrar. Aqui ele aparece.
for (const [rot, c] of [
  ["depois", cD],
  ["antes", cA],
]) {
  if (c && (c.timeouts || c.erros)) {
    const partes = [c.timeouts ? `${c.timeouts} estouraram o timeout` : null, c.erros ? `${c.erros} não subiram` : null]
      .filter(Boolean)
      .join(" e ");
    console.log(`\nAtenção: na coluna '${rot}', ${partes} — contam como não-injetados e puxam a taxa para baixo.`);
  }
}

// Portão do CA-2 — só quando há de fato duas versões do hook para comparar.
if (compara) {
  const piso = cD.taxa < PISO_DEPOIS;
  const dobro = cD.taxa < FATOR * cA.taxa;
  if (piso || dobro) {
    fail(
      `CA-2 não fechou: depois ${cD.taxa.toFixed(1)}%, antes ${cA.taxa.toFixed(1)}%\n` +
        (piso ? `  taxa depois abaixo do piso de ${PISO_DEPOIS}%\n` : "") +
        (dobro ? `  taxa depois abaixo de ${FATOR}x a taxa antes (${(FATOR * cA.taxa).toFixed(1)}%)\n` : "")
    );
  }
  console.log(`\nCA-2 OK: ${cD.taxa.toFixed(1)}% >= ${PISO_DEPOIS}% e >= ${FATOR}x ${cA.taxa.toFixed(1)}%`);
}
process.exit(0);

// Avaliação de retrieval: roda o golden set contra o servidor e mede nDCG@5.
// Sem isto, toda mudança em ranking é fé — é o que separa "mexi no BM25" de "melhorou".
//
// Existe como PORTÃO, e não só como relatório, desde o card #18: em 2026-09-10 o `hit@5` marcava
// 10/10 — saturado, sem margem nenhuma para acusar regressão. O nDCG@5 desconta a posição, então
// um alvo que cai do 1º para o 3º lugar aparece no número. `hit@1`, `hit@5` e `MRR` continuam
// impressos como secundários: são legíveis e o histórico existe.
//
//   node scripts/eval.mjs                          # relatório: roda tudo
//   node scripts/eval.mjs natural                  # só as queries em linguagem natural
//   node scripts/eval.mjs --base origin/dev        # PORTÃO: head (dist/) contra o ref base
//   node scripts/eval.mjs --base <ref> --repo <checkout>
//   BRAIN_DB=<banco> BRAIN_CONFIG=<config> BRAIN_GOLDEN=<golden> node scripts/eval.mjs
//
// Roda na INSTALAÇÃO: o índice vivo e o cache do modelo de embeddings só existem lá.
//
// Nunca contra o índice vivo, e sim contra um SNAPSHOT dele (`VACUUM INTO`): o servidor da rodada
// escreve `uso` e disputaria o lease do índice de produção — e medir base e head em momentos
// diferentes contra um índice que muda sozinho mediria deriva de índice e a chamaria de regressão.
//
// O `--base` sobe DOIS servidores, um de cada vez, contra o MESMO snapshot: o head é o `dist/` desta
// instalação, o base é o ref compilado na hora a partir do git do checkout. O checkout vem de
// `--repo` → `BRAIN_REPO` → a worktree onde o eval roda, se ele roda de dentro de uma →
// `worktree=` de `~/.claude/brain-sync-origem.txt` (o marcador do `sync push`).
//
// Códigos de saída — é o que torna o portão legível por máquina:
//   0  não caiu (sem --base, apenas relatório)
//   1  regrediu: nDCG@5 do head abaixo do base
//   2  NÃO CONSEGUI MEDIR: semântica caiu, caso apodrecido, base não compilou, checkout não
//      resolvido, branch do dist/ ≠ branch do checkout, dist/ mais velho que src/…
// Código 2 nunca é licença para seguir: é medição que não aconteceu, e barra a PR igual ao 1.
//
// BRAIN_EVAL_TETO_AQUECIMENTO_MS existe só para os testes de scripts/concorrencia.mjs: o teto
// real é 60 s, e um caso que prova "estourou o teto" não pode custar um minuto à suíte.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const CODIGO = { NAO_CAIU: 0, REGREDIU: 1, NAO_MEDI: 2 };

/**
 * Só contra ruído de ponto flutuante: a média de ~70 termos `1/log2(r+1)` pode diferir no último bit
 * conforme a ordem da soma. NÃO é faixa de tolerância, e não deve virar uma — eliminado o ruído da
 * semântica o eval é determinístico, e é isso que autoriza barrar qualquer queda.
 */
export const EPSILON = 1e-9;

/**
 * Fixo em todos os casos, inclusive nos cujo uso original pediu outro limite: a métrica é @5, e o
 * `colapsar` de `src/search.ts` se comporta em função do limite pedido — com outro limite, o top-5
 * medido não seria o top-5 que a busca devolve quando alguém pede 5.
 */
export const LIMITE = 5;

export const TETO_AQUECIMENTO_MS = Number(process.env.BRAIN_EVAL_TETO_AQUECIMENTO_MS) || 60000;
const INTERVALO_AQUECIMENTO_MS = 500;
const TIMEOUT_PEDIDO_MS = 30000;

// ---------------------------------------------------------------- a métrica

/**
 * nDCG@5 com relevância binária. O ganho é 1 no primeiro resultado que casa e 0 nos demais, então
 * IDCG@5 = 1/log2(2) = 1 e o nDCG é só o desconto da posição: `1 / log2(rank + 1)` no top-5, `0`
 * fora dele. Com um único alvo relevante isto é um MRR com desconto logarítmico — dito aqui para
 * ninguém se surpreender depois.
 *
 * `rank` é 1-based; 0 (ou qualquer valor fora de 1..5) quer dizer "não veio no top-5".
 */
export const ndcg5 = (rank) => (rank >= 1 && rank <= LIMITE ? 1 / Math.log2(rank + 1) : 0);

const BS = String.fromCharCode(92);
const norm = (s) => s.split(BS).join("/").toLowerCase();

/**
 * Os caminhos, na ordem, a partir do texto do `search_context`. Cada resultado é um bloco
 * `N. breadcrumb` / `[meta]` / `caminho` / `trecho` (`src/tools.ts`): o caminho é a 2ª linha depois
 * do cabeçalho numerado. Pela posição, e não por "linha que parece caminho absoluto": um trecho de
 * código que começa com `//` passaria por caminho num teste de formato.
 */
export function caminhosDaResposta(texto) {
  const linhas = String(texto ?? "").split("\n");
  const caminhos = [];
  for (let i = 0; i < linhas.length; i++) {
    if (/^\d+\. /.test(linhas[i]) && i + 2 < linhas.length) caminhos.push(linhas[i + 2].trim());
  }
  return caminhos;
}

/**
 * Os filtros gravados no caso, do jeito que a tool aceita. `null` não é filtro: a tool valida
 * `source` contra um enum, e mandar `null` seria erro de protocolo em vez de "sem filtro".
 */
export function argumentosDaBusca(caso) {
  const args = { query: caso.q, limit: LIMITE };
  for (const chave of ["source", "repo", "feature", "doc_type"]) {
    const v = caso.filtros?.[chave];
    if (v !== null && v !== undefined && v !== "") args[chave] = v;
  }
  return args;
}

/**
 * Avalia UM caso a partir da mensagem JSON-RPC crua. Devolve o nDCG e, quando a medição daquele caso
 * não vale, o motivo — que é o que decide o código 2.
 *
 * As três invalidações são distintas de propósito, e a ordem importa:
 *  - `sem-diagnostico`: não veio `_meta.brain`. NUNCA é tratado como `semantica === false` — ausente
 *    quer dizer "não sei se a semântica respondeu", e adivinhar aqui é o que faria o portão mentir.
 *  - `so-lexico`: veio o diagnóstico e a semântica não respondeu nesta consulta.
 *  - `apodreceu`: negativo `volatil` que passou a ter resultado. Não é regressão de ranking — é o
 *    índice que ganhou o assunto; o caso tem de ser recolhido.
 */
export function avaliar(caso, msg) {
  const base = { caso, rank: 0, ndcg: 0, caminhos: [], vazio: false, invalido: null };

  if (msg?.error || msg?.result?.isError === true) {
    const detalhe = msg.error ? JSON.stringify(msg.error) : String(msg.result?.content?.[0]?.text ?? "");
    return { ...base, invalido: { tipo: "erro", msg: `a tool respondeu erro: ${detalhe.slice(0, 200)}` } };
  }

  const brain = msg?.result?._meta?.brain;
  if (!brain || typeof brain.semantica !== "boolean") {
    return {
      ...base,
      invalido: {
        tipo: "sem-diagnostico",
        msg: "a resposta veio sem `_meta.brain` — não dá para saber se a semântica respondeu",
      },
    };
  }
  if (brain.semantica === false) {
    return { ...base, invalido: { tipo: "so-lexico", msg: "a busca semântica não respondeu nesta consulta" } };
  }

  const texto = String(msg.result?.content?.[0]?.text ?? "");
  const vazio = /^Nenhum resultado/.test(texto);
  const caminhos = vazio ? [] : caminhosDaResposta(texto);

  if (caso.tipo === "negativo") {
    if (!vazio && caso.volatil === true) {
      return {
        ...base,
        caminhos,
        invalido: {
          tipo: "apodreceu",
          msg: `negativo volátil passou a ter resultado (${caminhos.length}) — o caso apodreceu, recolha de novo`,
        },
      };
    }
    return { ...base, caminhos, vazio, ndcg: vazio ? 1 : 0 };
  }

  const alvos = [].concat(caso.esperado ?? []).map((a) => norm(String(a)));
  const i = caminhos.findIndex((p) => alvos.some((a) => norm(p).includes(a)));
  const rank = i >= 0 ? i + 1 : 0;
  return { ...base, caminhos, vazio, rank, ndcg: ndcg5(rank) };
}

/**
 * A rodada inteira. Um único caso inválido invalida tudo: a métrica é uma média, e média com buraco
 * é outro número. Sem `--base` não há comparação, então o melhor que uma rodada válida diz é 0.
 */
export function veredito(avaliacoes) {
  const invalidos = avaliacoes.filter((a) => a.invalido);
  const n = avaliacoes.length;
  const positivos = avaliacoes.filter((a) => a.caso.tipo !== "negativo");
  const negativos = avaliacoes.filter((a) => a.caso.tipo === "negativo");
  const soma = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
  return {
    codigo: invalidos.length || n === 0 ? CODIGO.NAO_MEDI : CODIGO.NAO_CAIU,
    invalidos,
    n,
    ndcg: n ? soma(avaliacoes, (a) => a.ndcg) / n : 0,
    positivos: positivos.length,
    hit1: positivos.filter((a) => a.rank === 1).length,
    hit5: positivos.filter((a) => a.rank >= 1 && a.rank <= LIMITE).length,
    mrr: positivos.length ? soma(positivos, (a) => (a.rank ? 1 / a.rank : 0)) / positivos.length : 0,
    negativos: negativos.length,
    negativosVazios: negativos.filter((a) => a.vazio).length,
  };
}

/**
 * Base contra head, as duas rodadas VÁLIDAS e sobre os mesmos casos na mesma ordem. Barra com
 * qualquer queda além do épsilon.
 *
 * `mudaram` existe porque o número diz que caiu e não diz onde: são os positivos cujo rank mudou e
 * os negativos que passaram de vazio a cheio (ou o contrário), os que mais caíram primeiro.
 */
export function comparar(base, head) {
  const mudaram = [];
  base.avaliacoes.forEach((b, i) => {
    const h = head.avaliacoes[i];
    const mudou = b.caso.tipo === "negativo" ? b.vazio !== h.vazio : b.rank !== h.rank;
    if (mudou) mudaram.push({ caso: b.caso, base: b, head: h });
  });
  mudaram.sort((x, y) => x.head.ndcg - x.base.ndcg - (y.head.ndcg - y.base.ndcg));
  return {
    codigo: head.v.ndcg < base.v.ndcg - EPSILON ? CODIGO.REGREDIU : CODIGO.NAO_CAIU,
    delta: head.v.ndcg - base.v.ndcg,
    mudaram,
  };
}

// ---------------------------------------------------------------- aquecimento

/**
 * Medido em 2026-09-11 (decisão #468): o modelo fica pronto entre +0,4 s e +5,7 s do boot, e a
 * primeira consulta antes disso sai só com léxico e devolve um 1º lugar DIFERENTE. Sem esperar,
 * boa parte da rodada terminaria antes de o modelo existir.
 *
 * Diagnóstico ausente sai na hora em vez de esperar o teto: `_meta.brain` não é questão de tempo,
 * é de versão do servidor — esperar 60 s por ele só atrasaria o mesmo código 2.
 */
export async function aquecer(pedir, { teto = TETO_AQUECIMENTO_MS, intervalo = INTERVALO_AQUECIMENTO_MS } = {}) {
  const t0 = Date.now();
  for (;;) {
    const msg = await pedir("tools/call", {
      name: "search_context",
      arguments: { query: "aquecimento do eval", limit: 1 },
    });
    if (msg?.error || msg?.result?.isError === true) {
      return { ok: false, ms: Date.now() - t0, motivo: `a busca de aquecimento respondeu erro: ${JSON.stringify(msg.error ?? msg.result).slice(0, 200)}` };
    }
    const brain = msg?.result?._meta?.brain;
    if (!brain || typeof brain.semantica !== "boolean") {
      return { ok: false, ms: Date.now() - t0, motivo: "o servidor responde sem `_meta.brain` — não dá para saber se a semântica respondeu" };
    }
    if (brain.semantica === true) return { ok: true, ms: Date.now() - t0 };
    if (Date.now() - t0 >= teto) {
      return { ok: false, ms: Date.now() - t0, motivo: `a busca semântica não respondeu em ${Math.round(teto / 1000)} s de aquecimento` };
    }
    await new Promise((r) => setTimeout(r, intervalo));
  }
}

// ---------------------------------------------------------------- snapshot

/**
 * `VACUUM INTO` dá cópia consistente INCLUINDO o conteúdo do WAL num arquivo único; copiar
 * `brain.db` + `-wal` + `-shm` à mão não garante isso. Duas ressalvas do SQLite, respeitadas aqui:
 * o destino não pode existir (daí `mkdtemp`, e não caminho fixo), e a cópia é do tamanho do índice
 * (~155 MB), uma vez por rodada. A conexão de origem é só-leitura: o snapshot nunca escreve no vivo.
 */
export function tirarSnapshot(origem) {
  const dir = mkdtempSync(join(tmpdir(), "brain-eval-"));
  const arquivo = join(dir, "snapshot.db");
  try {
    const db = new DatabaseSync(origem, { readOnly: true });
    try {
      db.exec("PRAGMA busy_timeout = 30000");
      db.prepare("VACUUM INTO ?").run(arquivo);
    } finally {
      db.close();
    }
    return { dir, arquivo };
  } catch (err) {
    limpar(dir);
    throw err;
  }
}

/** Em Windows o arquivo pode ficar preso por alguns instantes depois de o servidor morrer. */
export function limpar(dir) {
  if (!dir) return;
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.error(`  aviso: não consegui apagar ${dir}: ${err.message}`);
  }
}

// ---------------------------------------------------------------- de onde veio o head (--base)

const ARQUIVO_MARCADOR = "brain-sync-origem.txt";

function git(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", windowsHide: true });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr || r.error?.message || "").trim() };
}

/** O `sync.sh` grava `/c/Users/x` (Git Bash) e o `sync.ps1` grava `C:\Users\x`; o Node só abre o segundo. */
const caminhoNativo = (p) => (process.platform === "win32" ? p.replace(/^\/([a-zA-Z])(?=\/|$)/, "$1:") : p);

const mesmoCaminho = (a, b) => {
  const n = (p) => {
    const s = resolve(caminhoNativo(p)).split(BS).join("/").replace(/\/+$/, "");
    return process.platform === "win32" ? s.toLowerCase() : s;
  };
  return n(a) === n(b);
};

/** Mesmo arquivo e mesma regra do `sync.sh`/`sync.ps1`: `$CLAUDE_CONFIG_DIR` ou `~/.claude`; a última linha vence. */
export function lerMarcador(env = process.env) {
  const arquivo = join(env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), ARQUIVO_MARCADOR);
  if (!existsSync(arquivo)) return { arquivo, existe: false, worktree: null, branch: null };
  const campos = {};
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = /^(worktree|branch)=(.*)$/.exec(linha);
    if (m && m[2].trim()) campos[m[1]] = m[2].trim();
  }
  return {
    arquivo,
    existe: true,
    worktree: campos.worktree ? caminhoNativo(campos.worktree) : null,
    branch: campos.branch ?? null,
  };
}

/**
 * A worktree git DESTE repo que contém a pasta onde o eval roda, ou `null`. "Deste repo" quer dizer
 * que a raiz dela tem esta `brain-mcp/`: uma instalação que por acaso more dentro de outro
 * repositório qualquer não é checkout de nada.
 */
function worktreeDaInstalacao(raiz) {
  const r = git(raiz, ["rev-parse", "--show-toplevel"]);
  return r.ok && r.out && mesmoCaminho(join(r.out, "brain-mcp"), raiz) ? r.out : null;
}

/**
 * Resolve o checkout e aplica a GUARDA DE BRANCH. Devolve `{ checkout, branch, origem }` ou
 * `{ erro: [linhas] }` — e nunca compila, nem copia, nem abre banco: roda antes de qualquer trabalho.
 *
 * De que branch veio o `dist/` (emenda 2026-09-14 da spec):
 *  - a pasta onde o eval roda está numa worktree git deste repo → o `dist/` foi compilado DELA, e a
 *    branch dela é a resposta. O marcador não é lido: ele descreve a instalação viva de `~/.claude`,
 *    que é outra pasta — e é o caso de quem instalou do clone (`install.sh` registra
 *    `<repo>/brain-mcp/dist/index.js`) e da verificação feita de uma worktree;
 *  - a pasta não é git → só o `branch=` do marcador sabe. Sem ele a guarda não tem o que comparar,
 *    e passar em silêncio seria devolver "não caiu" sem saber o que foi medido: código 2.
 */
export function resolverOrigem({ raiz, repo = null, env = process.env }) {
  const marcador = lerMarcador(env);
  const propria = worktreeDaInstalacao(raiz);
  const candidatos = [
    ["--repo", repo],
    ["BRAIN_REPO", env.BRAIN_REPO || null],
    ["a worktree onde o eval roda", propria],
    [`o worktree= de ${marcador.arquivo}`, marcador.worktree],
  ];
  const escolhido = candidatos.find(([, caminho]) => caminho);
  if (!escolhido) {
    return {
      erro: [
        "não sei onde está o checkout do repositório, e o --base precisa do git dele para compilar o ref. Diga por uma das três saídas:",
        "  --repo <caminho do checkout>",
        "  BRAIN_REPO=<caminho do checkout>",
        `  ${marcador.arquivo} — escrito pelo \`./sync.sh push\` / \`./sync.ps1 push\` do checkout`,
      ],
    };
  }

  const [origem, caminho] = escolhido;
  const topo = git(caminho, ["rev-parse", "--show-toplevel"]);
  if (!topo.ok || !topo.out) {
    return { erro: [`${origem} aponta para ${caminho}, que não é repositório git: ${topo.err || "(sem saída)"}`] };
  }
  const checkout = topo.out;
  const branchCheckout = git(checkout, ["rev-parse", "--abbrev-ref", "HEAD"]).out;

  let branchHead;
  let deOnde;
  if (propria) {
    branchHead = git(propria, ["rev-parse", "--abbrev-ref", "HEAD"]).out;
    deOnde = `a worktree onde o eval roda (${propria})`;
  } else if (marcador.branch) {
    branchHead = marcador.branch;
    deOnde = `o branch= de ${marcador.arquivo}`;
  } else {
    return {
      erro: [
        `não sei de que branch veio o dist/ de ${raiz}: a pasta não é git e ${marcador.existe ? `${marcador.arquivo} não tem branch=` : `${marcador.arquivo} não existe`}.`,
        "  Sem isso a guarda de branch não tem o que comparar. Rode o `sync push` a partir do checkout, ou rode o eval de dentro dele.",
      ],
    };
  }

  if (branchHead !== branchCheckout) {
    return {
      erro: [
        `o dist/ que seria medido veio da branch "${branchHead}" (${deOnde}), e o checkout ${checkout} está em "${branchCheckout}".`,
        "  O portão compararia o base com código de outra branch. Sincronize a instalação a partir desta branch (`sync push` + `npm run build`), ou aponte o --repo para o checkout certo.",
      ],
    };
  }
  return { checkout, branch: branchCheckout, origem };
}

/**
 * A GUARDA DE FRESCOR: `dist/index.js` mais velho que o `src/*.ts` mais recente quer dizer que o head
 * mediria código anterior à última edição — o "nada avisa quando ele fica velho" do CLAUDE.md,
 * virando aviso. Numa worktree ela também pega o `git checkout` de outra branch sem rebuild, que
 * reescreve os `src/*.ts` que diferem.
 */
export function conferirFrescor(raiz) {
  const dist = join(raiz, "dist", "index.js");
  const src = join(raiz, "src");
  if (!existsSync(dist)) return { erro: `${dist} não existe — rode \`npm run build\`` };
  let maisNovo = null;
  for (const rel of existsSync(src) ? readdirSync(src, { recursive: true }) : []) {
    if (!String(rel).endsWith(".ts")) continue;
    const ms = statSync(join(src, rel)).mtimeMs;
    if (!maisNovo || ms > maisNovo.ms) maisNovo = { rel: String(rel).split(BS).join("/"), ms };
  }
  if (!maisNovo) return { erro: `não achei nenhum src/*.ts em ${raiz}: sem eles não dá para saber se o dist/ está em dia` };
  if (statSync(dist).mtimeMs < maisNovo.ms) {
    return {
      erro: `dist/index.js é mais velho que src/${maisNovo.rel}: o head mediria código anterior à última edição. Rode \`npm run build\` em ${raiz}`,
    };
  }
  return { ok: true };
}

/**
 * Compila o ref base. Os dois detalhes de caminho não são estética, cada um evita uma falha concreta:
 *  - extrai DENTRO da instalação (`.eval-base/`), não no temporário: o `tsc` resolve `node_modules`,
 *    `@types/node` e o `"type": "module"` do package.json subindo a partir do tsconfig, e num
 *    temporário não há nada disso acima;
 *  - `-p <tsconfig>` com `--outDir`, e não `--rootDir`/`--outDir` soltos: arquivos ou rootDir na linha
 *    de comando fazem o `tsc` ignorar o tsconfig inteiro e cair para ES5/CommonJS, onde nem o
 *    `import.meta` nem o top-level await compilam. De quebra vale o tsconfig DO REF BASE.
 * O `dist-base/` fica ao lado do `dist/` pelo mesmo motivo: `packageRoot` e o cache do modelo seguem
 * apontando para a instalação.
 */
export function compilarBase({ raiz, checkout, ref, estado }) {
  const extraido = join(raiz, ".eval-base");
  const saida = join(raiz, "dist-base");
  estado.compilados = [extraido, saida];
  // Sobra de rodada morta por SIGKILL: um `.ts` que o ref base não tem entraria na compilação dele.
  limpar(extraido);
  limpar(saida);
  mkdirSync(extraido, { recursive: true });

  const arquivo = spawnSync("git", ["-C", checkout, "archive", "--format=tar", ref, "brain-mcp/src", "brain-mcp/tsconfig.json"], {
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  if (arquivo.status !== 0) {
    return { erro: `git archive ${ref} falhou em ${checkout}: ${String(arquivo.stderr || arquivo.error?.message || "").trim()}` };
  }
  // O tar roda com cwd no destino e lê do stdin: nenhum caminho vai na linha de comando, então o `C:`
  // de um caminho Windows nunca chega ao GNU tar do Git Bash, que o leria como host remoto.
  const tar = spawnSync("tar", ["-x", "-f", "-"], { cwd: extraido, input: arquivo.stdout, windowsHide: true });
  if (tar.status !== 0) return { erro: `tar não extraiu o ref ${ref}: ${String(tar.stderr || tar.error?.message || "").trim()}` };

  const tsc = join(raiz, "node_modules", "typescript", "bin", "tsc");
  if (!existsSync(tsc)) return { erro: `${tsc} não existe — o base se compila com o tsc da instalação; rode \`npm ci\`` };
  const t0 = Date.now();
  const c = spawnSync(process.execPath, [tsc, "-p", join(extraido, "brain-mcp", "tsconfig.json"), "--outDir", saida], {
    cwd: raiz,
    encoding: "utf8",
    windowsHide: true,
  });
  if (c.status !== 0) {
    const rastro = `${c.stdout ?? ""}${c.stderr ?? ""}`.trim().split("\n").slice(-8).join("\n    ");
    return { erro: `o ref ${ref} não compilou:\n    ${rastro || c.error?.message || `tsc saiu com ${c.status}`}` };
  }
  return { entrada: join(saida, "index.js"), ms: Date.now() - t0 };
}

// ---------------------------------------------------------------- servidor

function subirServidor(entrada, env) {
  const child = spawn(process.execPath, [entrada], { cwd: root, stdio: ["pipe", "pipe", "pipe"], env });
  const pendentes = new Map();
  let buf = "";
  let err = "";
  let saida = null;

  // stderr é lido (e não ignorado) por dois motivos: um pipe cheio e não drenado trava o filho, e
  // quando o servidor morre é o rastro dele que diz por quê.
  child.stderr.on("data", (d) => (err = (err + d.toString()).slice(-4000)));
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const linha = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!linha) continue;
      try {
        const m = JSON.parse(linha);
        if (m.id !== undefined && pendentes.has(m.id)) {
          pendentes.get(m.id).res(m);
          pendentes.delete(m.id);
        }
      } catch {
        /* linha não-JSON */
      }
    }
  });
  const morto = new Promise((res) =>
    child.on("exit", (code, sinal) => {
      saida = { code, sinal };
      // Servidor morto não responde mais nada: sem isto cada caso restante esperaria o timeout.
      for (const p of pendentes.values()) p.rej(new Error(`o servidor morreu (${JSON.stringify(saida)})`));
      pendentes.clear();
      res();
    })
  );

  let proxId = 1;
  const pedir = (method, params) =>
    new Promise((res, rej) => {
      if (saida) return rej(new Error(`o servidor morreu (${JSON.stringify(saida)})`));
      const id = proxId++;
      const t = setTimeout(() => {
        pendentes.delete(id);
        rej(new Error(`timeout (${TIMEOUT_PEDIDO_MS / 1000} s) em ${method}`));
      }, TIMEOUT_PEDIDO_MS);
      pendentes.set(id, {
        res: (m) => (clearTimeout(t), res(m)),
        rej: (e) => (clearTimeout(t), rej(e)),
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });

  return {
    pedir,
    rastro: () => err.trim().split("\n").slice(-6).join("\n    "),
    async handshake() {
      await pedir("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "eval", version: "0" } });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
    },
    /** Mata e ESPERA morrer: enquanto o processo vive, o Windows não deixa apagar o snapshot. */
    async encerrar() {
      if (!saida) {
        try {
          child.kill();
        } catch {
          /* já morreu */
        }
      }
      await Promise.race([morto, new Promise((r) => setTimeout(r, 5000))]);
    },
    matarJa() {
      try {
        child.kill();
      } catch {
        /* já morreu */
      }
    },
  };
}

// ---------------------------------------------------------------- relatório

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ultimosDois = (p) => norm(p).split("/").slice(-2).join("/");

function marca(a) {
  if (a.invalido) return "!!  ";
  if (a.caso.tipo === "negativo") return a.vazio ? "∅ok " : "✗∅  ";
  return a.rank === 1 ? "✓@1 " : a.rank > 1 ? `~@${a.rank} ` : "✗   ";
}

function naoMedi(motivos) {
  console.error("\nEVAL: NÃO CONSEGUI MEDIR (código 2)");
  for (const m of motivos) console.error(`  x ${m}`);
  console.error("  Isto não diz que o ranking piorou: diz que a medição não aconteceu. Não é licença para seguir.");
  return CODIGO.NAO_MEDI;
}

const resumo = (v) =>
  `nDCG@5 ${v.ndcg.toFixed(3)} (${v.n} casos)  ·  hit@1 ${v.hit1}/${v.positivos} (${pct(v.hit1, v.positivos)}%)` +
  `  ·  hit@5 ${v.hit5}/${v.positivos} (${pct(v.hit5, v.positivos)}%)  ·  MRR ${v.mrr.toFixed(2)}` +
  `  ·  negativos vazios ${v.negativosVazios}/${v.negativos}`;

const posicao = (a) => (a.caso.tipo === "negativo" ? (a.vazio ? "vazio" : "cheio") : a.rank ? `@${a.rank}` : "fora");

function imprimirComparacao(ref, base, head, cmp) {
  const linha = (rotulo, v) =>
    `  ${rotulo.padEnd(24)} ${v.ndcg.toFixed(3).padStart(6)}  ${`${v.hit1}/${v.positivos}`.padStart(7)}  ` +
    `${`${v.hit5}/${v.positivos}`.padStart(7)}  ${v.mrr.toFixed(2).padStart(5)}  ${`${v.negativosVazios}/${v.negativos}`.padStart(11)}`;
  console.log(
    `\n  ${"".padEnd(24)} ${"nDCG@5".padStart(6)}  ${"hit@1".padStart(7)}  ${"hit@5".padStart(7)}  ${"MRR".padStart(5)}  ${"neg. vazios".padStart(11)}`
  );
  console.log(linha(`base  ${ref}`, base.v));
  console.log(linha("head  dist/", head.v));
  console.log(`  ${"delta".padEnd(24)} ${((cmp.delta >= 0 ? "+" : "") + cmp.delta.toFixed(3)).padStart(6)}`);

  if (!cmp.mudaram.length) {
    console.log("\nNenhum caso mudou de posição.");
    return;
  }
  console.log(`\nMudaram de posição (${cmp.mudaram.length}), os que mais caíram primeiro:`);
  for (const m of cmp.mudaram) {
    const d = m.head.ndcg - m.base.ndcg;
    console.log(
      `  ${posicao(m.base).padStart(5)} → ${posicao(m.head).padEnd(5)}  ${((d >= 0 ? "+" : "") + d.toFixed(2)).padStart(5)}  [${m.caso.estilo}] ${m.caso.q}`
    );
  }
}

// ---------------------------------------------------------------- CLI

/** `--base <ref>` e `--repo <caminho>`, também na forma `--base=<ref>`. Tudo o mais que começa com `-` é erro. */
export function lerArgumentos(argv) {
  const r = { estilo: undefined, base: null, repo: null, erros: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const m = /^--(base|repo)(?:=(.*))?$/.exec(a);
    if (m) {
      const valor = m[2] ?? argv[++i];
      // Um ref que começa com "-" chegaria ao `git archive` como opção.
      if (!valor || valor.startsWith("-")) r.erros.push(`--${m[1]} precisa de um valor`);
      else r[m[1]] = valor;
    } else if (a.startsWith("-")) {
      // Flag desconhecida é código 2, e não silêncio: uma opção ignorada pode ser justamente a que
      // mandava comparar, e o eval imprimiria "não caiu" sem ter comparado nada.
      r.erros.push(`opção não reconhecida: ${a}`);
    } else if (r.estilo === undefined) {
      r.estilo = a;
    } else {
      r.erros.push(`argumento a mais: ${a}`);
    }
  }
  if (r.repo && !r.base) r.erros.push("--repo só vale com --base: sem comparação não há checkout a resolver");
  return r;
}

/**
 * Uma rodada inteira contra o snapshot: sobe, aquece, mede todos os casos e derruba. Devolve
 * `{ v, avaliacoes }` quando a medição valeu, `{ motivos }` quando não.
 */
async function rodada({ rotulo, entrada, snapshot, config, casos, estado, verboso }) {
  const srv = subirServidor(entrada, {
    ...process.env,
    BRAIN_DB: snapshot,
    BRAIN_CONFIG: config,
    BRAIN_SOMENTE_CONSULTA: "1",
  });
  estado.servidor = srv;
  const prefixo = rotulo ? `${rotulo}: ` : "";
  try {
    await srv.handshake();
    const aq = await aquecer(srv.pedir);
    if (!aq.ok) return { motivos: [`${prefixo}${aq.motivo}`] };
    console.log(`${prefixo}semântica pronta em ${(aq.ms / 1000).toFixed(1)} s · ${casos.length} casos${verboso ? "\n" : ""}`);

    const avaliacoes = [];
    for (const caso of casos) {
      const a = avaliar(caso, await srv.pedir("tools/call", { name: "search_context", arguments: argumentosDaBusca(caso) }));
      avaliacoes.push(a);
      if (verboso) console.log(`${marca(a)} ${a.ndcg.toFixed(2)} [${caso.estilo}] ${caso.q}${a.invalido ? `  <- ${a.invalido.msg}` : ""}`);
    }

    const v = veredito(avaliacoes);
    // Sem o número de propósito: uma média com casos inválidos é outro número, e impresso ele seria
    // lido como medição.
    if (v.codigo === CODIGO.NAO_MEDI) {
      return { motivos: v.invalidos.map((a) => `${prefixo}[${a.invalido.tipo}] "${a.caso.q}": ${a.invalido.msg}`) };
    }
    return { v, avaliacoes };
  } catch (err) {
    const rastro = srv.rastro();
    return { motivos: [`${prefixo}${err.message}${rastro ? `\n    stderr do servidor:\n    ${rastro}` : ""}`] };
  } finally {
    // Morto e ESPERADO antes da próxima rodada: dois servidores juntos disputariam CPU, e a semântica
    // que estoura o timeout invalida a rodada.
    await srv.encerrar();
  }
}

async function main(estado) {
  const args = lerArgumentos(process.argv.slice(2));
  if (args.erros.length) return naoMedi(args.erros);

  const caminhoGolden = process.env.BRAIN_GOLDEN || join(root, "scripts", "golden.json");
  const dbOrigem = process.env.BRAIN_DB || join(root, "data", "brain.db");
  const config = process.env.BRAIN_CONFIG || join(root, "brain.config.json");
  const entrada = join(root, "dist", "index.js");

  let golden;
  try {
    golden = JSON.parse(readFileSync(caminhoGolden, "utf8"));
  } catch (err) {
    return naoMedi([`golden set ilegível em ${caminhoGolden}: ${err.message}`]);
  }
  const casos = args.estilo ? golden.filter((g) => g.estilo === args.estilo) : golden;
  if (!casos.length) return naoMedi([`nenhum caso${args.estilo ? ` com estilo "${args.estilo}"` : ""} em ${caminhoGolden}`]);
  if (!existsSync(dbOrigem)) return naoMedi([`banco não encontrado em ${dbOrigem} — rode na instalação, ou aponte o BRAIN_DB`]);
  if (!existsSync(config)) return naoMedi([`config não encontrado em ${config} — rode na instalação, ou aponte o BRAIN_CONFIG`]);
  if (!existsSync(entrada)) return naoMedi([`${entrada} não existe — rode \`npm run build\``]);

  // As duas guardas, ANTES de qualquer trabalho: sem elas o portão compara o base com um dist/ de
  // outra branch ou anterior à última edição, e devolve "não caiu" com toda a confiança.
  let origem = null;
  if (args.base) {
    origem = resolverOrigem({ raiz: root, repo: args.repo });
    if (origem.erro) return naoMedi(origem.erro);
    const frescor = conferirFrescor(root);
    if (frescor.erro) return naoMedi([frescor.erro]);
    console.log(`checkout: ${origem.checkout} (branch ${origem.branch}, via ${origem.origem})`);
  }

  try {
    const t0 = Date.now();
    estado.snapshot = tirarSnapshot(dbOrigem);
    console.log(`snapshot: ${estado.snapshot.arquivo} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    const comum = { snapshot: estado.snapshot.arquivo, config, casos, estado };

    if (!args.base) {
      const r = await rodada({ ...comum, rotulo: "", entrada, verboso: true });
      if (r.motivos) return naoMedi(r.motivos);
      console.log(`\n${resumo(r.v)}`);
      const abaixo = r.avaliacoes.filter((a) => a.ndcg < 1);
      if (abaixo.length) {
        console.log("\nAbaixo de 1:");
        for (const a of abaixo) {
          const esperado = a.caso.tipo === "negativo" ? "(vazio)" : [].concat(a.caso.esperado).join(" ou ");
          console.log(`  "${a.caso.q}"\n    esperado: ${esperado}\n    veio:     ${a.caminhos.slice(0, 3).map(ultimosDois).join(" | ") || "(vazio)"}`);
        }
      }
      console.log("\nEVAL OK (código 0) — medição válida; sem --base não há comparação, é relatório.");
      return CODIGO.NAO_CAIU;
    }

    const compilado = compilarBase({ raiz: root, checkout: origem.checkout, ref: args.base, estado });
    if (compilado.erro) return naoMedi([`o base não compilou — ${compilado.erro}`]);
    console.log(`base: ${args.base} compilado em ${(compilado.ms / 1000).toFixed(1)} s`);

    const base = await rodada({ ...comum, rotulo: `base (${args.base})`, entrada: compilado.entrada });
    if (base.motivos) return naoMedi(base.motivos);
    const head = await rodada({ ...comum, rotulo: "head (dist/)", entrada });
    if (head.motivos) return naoMedi(head.motivos);

    const cmp = comparar(base, head);
    imprimirComparacao(args.base, base, head, cmp);
    if (cmp.codigo === CODIGO.REGREDIU) {
      console.error(
        `\nEVAL: REGREDIU (código 1) — nDCG@5 do head ${head.v.ndcg.toFixed(3)} abaixo do base ${base.v.ndcg.toFixed(3)}.` +
          " O portão é estrito: qualquer queda barra a PR."
      );
      return CODIGO.REGREDIU;
    }
    console.log(`\nEVAL OK (código 0) — não caiu: nDCG@5 do head ${head.v.ndcg.toFixed(3)}, do base ${base.v.ndcg.toFixed(3)}.`);
    return CODIGO.NAO_CAIU;
  } catch (err) {
    const rastro = estado.servidor?.rastro();
    return naoMedi([err.message + (rastro ? `\n    stderr do servidor:\n    ${rastro}` : "")]);
  }
}

/** Snapshot, `.eval-base/` e `dist-base/`: os três saem em qualquer caminho de saída. */
function limparTudo(estado) {
  limpar(estado.snapshot?.dir);
  for (const dir of estado.compilados ?? []) limpar(dir);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const estado = { snapshot: null, servidor: null, compilados: [] };
  // Ctrl+C no meio da rodada: sem isto ficariam ~155 MB de snapshot órfão no temporário a cada
  // interrupção, e um dist-base/ velho na instalação. Síncrono e sem esperar o filho — é o melhor
  // que um handler de sinal pode fazer.
  process.on("SIGINT", () => {
    estado.servidor?.matarJa();
    limparTudo(estado);
    process.exit(CODIGO.NAO_MEDI);
  });
  let codigo = CODIGO.NAO_MEDI;
  try {
    codigo = await main(estado);
  } catch (err) {
    // Exceção que escapasse daqui viraria rejeição não tratada, e o Node sairia com código 1 — que
    // neste script quer dizer "regrediu". Qualquer coisa inesperada é, por definição, não ter medido.
    codigo = naoMedi([`erro inesperado: ${err?.stack ?? err}`]);
  } finally {
    await estado.servidor?.encerrar();
    limparTudo(estado);
  }
  process.exit(codigo);
}

// Colhe o golden set do USO REAL: o que o Claude perguntou de verdade, e o documento que ele
// abriu logo depois. Existe porque um golden set redigido à mão mede a busca que o autor imagina,
// não a que acontece — e um set assim satura: em 2026-09-10 os 10 casos escolhidos a dedo marcavam
// hit@5 10/10, sem margem nenhuma para acusar regressão. Sem este script o portão do eval não
// teria o que barrar.
//
//   node scripts/colher-golden.mjs
//   BRAIN_DB=<caminho> BRAIN_GOLDEN=<caminho> node scripts/colher-golden.mjs
//
// Roda na INSTALAÇÃO: a tabela `uso` e a `docs` contra a qual os alvos são revalidados só existem
// no banco de lá. O checkout não tem banco nenhum.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 90 s é escolha medida, não palpite: 30 s -> 71 pares, 60 s -> 73, 90 s -> 77, 120 s -> 79,
 * 300 s -> 90. Depois de 90 s a curva vira captura de pares de sessões DIFERENTES, porque a tabela
 * `uso` não tem coluna de sessão e o pareamento é puramente temporal.
 */
export const JANELA_MS = 90000;

/** Piso do CA2. Abaixo disto o conjunto é pequeno demais para um delta de nDCG significar algo. */
export const MINIMO = 60;

export const norm = (s) => s.split("\\").join("/").toLowerCase();

/**
 * Preserva o filtro de CLI que já existe (`node scripts/eval.mjs natural`). Vale também para os
 * negativos: um caso sem `estilo` sumiria em silêncio de toda rodada filtrada, e negativo que some
 * é portão que deixa de conferir justamente o que ninguém confere na mão.
 */
export const estiloDe = (q) => (q.includes("?") || q.trim().split(/\s+/).length > 5 ? "natural" : "keywords");

/**
 * Os dois últimos segmentos, como o `eval` já compara (`norm(p).includes(a)`). Caminho absoluto de
 * máquina não entra em arquivo versionado — o golden set é público e roda em outra máquina.
 */
export const doisSegmentos = (p) => norm(p).split("/").slice(-2).join("/");

/** Os mesmos quatro filtros que `search.ts:184-187` aplica, e com a mesma semântica: igualdade. */
export const satisfaz = (d, f = {}) =>
  (!f.source || d.source === f.source) &&
  (!f.repo || d.repo === f.repo) &&
  (!f.feature || d.feature === f.feature) &&
  (!f.doc_type || d.doc_type === f.doc_type);

export function indexarDocs(db) {
  const todos = db
    .prepare("SELECT path, source, repo, feature, doc_type FROM docs")
    .all()
    .map((d) => ({
      path: norm(d.path),
      source: d.source,
      repo: d.repo,
      feature: d.feature,
      doc_type: d.doc_type,
    }));
  return { todos, porPath: new Map(todos.map((d) => [d.path, d])) };
}

/**
 * Os documentos que PODERIAM satisfazer o caso: casam algum fragmento de `esperado` **e** passam
 * pelos filtros gravados. Conjunto vazio num caso positivo quer dizer caso insatisfazível — a busca
 * gravada, com os filtros gravados, jamais devolveria o alvo gravado.
 */
export function resolverAlvo(caso, docs) {
  const fragmentos = [].concat(caso.esperado ?? []).map((a) => norm(a));
  if (!fragmentos.length) return [];
  return docs.todos.filter((d) => satisfaz(d, caso.filtros) && fragmentos.some((a) => d.path.includes(a)));
}

const chaveQuery = (q) => q.trim().toLowerCase();

/**
 * Pareia `search_context` -> `read_doc` e devolve os casos, mais o porquê de cada descarte. Os
 * descartes são contados e não engolidos: é por eles que se percebe que a janela ficou curta ou que
 * o índice mudou por baixo.
 */
export function colher(db) {
  const linhas = db
    .prepare("SELECT ts, tool, args, vazio FROM uso WHERE tool IN ('search_context','read_doc') ORDER BY ts")
    .all();
  const docs = indexarDocs(db);
  const casos = [];
  const avisos = [];
  const contagem = { brutos: 0, semPar: 0, semAlvo: 0, incoerentes: 0, repetidas: 0 };
  const vistos = new Set();

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.tool !== "search_context" || l.vazio) continue;
    let args;
    try {
      args = JSON.parse(l.args ?? "{}");
    } catch {
      continue;
    }
    if (!args.query || !args.query.trim()) continue;

    // O PRIMEIRO `read_doc` da janela. Parar no primeiro é o que mantém o par plausível: o segundo
    // já pode ser fruto da leitura do primeiro, e não da busca.
    let leitura = null;
    for (let j = i + 1; j < linhas.length; j++) {
      if (linhas[j].ts - l.ts > JANELA_MS) break;
      if (linhas[j].tool === "read_doc") {
        leitura = linhas[j];
        break;
      }
    }
    if (!leitura) {
      contagem.semPar++;
      continue;
    }
    let alvo;
    try {
      alvo = JSON.parse(leitura.args ?? "{}");
    } catch {
      continue;
    }
    if (!alvo.path) continue;
    contagem.brutos++;

    // Dedup por query normalizada, vencendo a PRIMEIRA ocorrência: a primeira é a pergunta como ela
    // nasceu; as seguintes já são o humano insistindo depois de ter lido alguma coisa.
    const chave = chaveQuery(args.query);
    if (vistos.has(chave)) {
      contagem.repetidas++;
      continue;
    }
    vistos.add(chave);

    const doc = docs.porPath.get(norm(alvo.path));
    if (!doc) {
      contagem.semAlvo++;
      avisos.push(`alvo fora de docs (apodreceu ou saiu do índice): ${doisSegmentos(alvo.path)} — "${args.query}"`);
      continue;
    }

    const filtros = {
      source: args.source ?? null,
      repo: args.repo ?? null,
      feature: args.feature ?? null,
      doc_type: args.doc_type ?? null,
    };

    // Emenda 2026-09-11: coerência, e não só existência. `search.ts:184-187` aplica os filtros como
    // igualdade literal, então um alvo que não os satisfaz nunca poderia ter vindo daquela busca: é
    // PAR TEMPORAL FALSO — o `read_doc` veio de outra busca dentro da janela. Emitido como positivo
    // valeria 0 no nDCG para sempre, no base e no head, e ensinaria o revisor a ignorar vermelho.
    // Medido em 2026-09-11: 7 dos 75 pares eram destes, 4 deles `repo: operations-center` sobre um
    // `mapa` de repo null — a mesma combinação que o negativo estrutural usa de propósito.
    if (!satisfaz(doc, filtros)) {
      contagem.incoerentes++;
      avisos.push(
        `alvo não satisfaz os próprios filtros (par temporal falso): ${doisSegmentos(doc.path)} ` +
          `[source=${doc.source} repo=${doc.repo}] vs ${JSON.stringify(filtros)} — "${args.query}"`
      );
      continue;
    }

    casos.push({
      q: args.query,
      filtros,
      esperado: [doisSegmentos(doc.path)],
      tipo: "positivo",
      estilo: estiloDe(args.query),
      origem: `uso:${new Date(l.ts).toISOString().slice(0, 10)}`,
    });
  }

  return { casos, avisos, contagem, docs };
}

const ehColhido = (c) => String(c.origem ?? "").startsWith("uso:");

/** Ordem fixa de chaves: sem isto o `git diff` de cada recolheita viraria ruído. */
function normalizarCaso(c) {
  const saida = {
    q: c.q,
    filtros: {
      source: c.filtros?.source ?? null,
      repo: c.filtros?.repo ?? null,
      feature: c.filtros?.feature ?? null,
      doc_type: c.filtros?.doc_type ?? null,
    },
    esperado: [].concat(c.esperado ?? []),
    tipo: c.tipo ?? "positivo",
    estilo: c.estilo ?? estiloDe(c.q),
  };
  if (saida.tipo === "negativo") saida.volatil = c.volatil === true;
  saida.origem = c.origem ?? "manual";
  if (c.nota) saida.nota = c.nota;
  return saida;
}

/**
 * Preservação: caso `manual` sobrevive INTACTO a toda recolheita; só os `uso:*` são substituídos.
 * Quem não tem `origem` é do formato antigo e vira `manual` aqui — é a remarcação única de que a
 * spec fala, e depois dela o caso nunca mais é tocado.
 *
 * O manual também vence o colhido na mesma query. Sem isto, uma query que o smoke dispara contra o
 * índice vivo poderia reaparecer como caso colhido ao lado do manual homônimo, e o conjunto passaria
 * a contar duas vezes a mesma pergunta.
 */
export function mesclar(atuais, colhidos) {
  const manuais = atuais.filter((c) => !ehColhido(c)).map(normalizarCaso);
  const doManual = new Set(manuais.map((c) => chaveQuery(c.q)));
  const novos = colhidos.filter((c) => !doManual.has(chaveQuery(c.q))).map(normalizarCaso);
  return { casos: [...manuais, ...novos], manuais: manuais.length, colhidos: novos.length };
}

/**
 * A asserção de cobertura mora AQUI, e não num teste à parte, porque é o próprio ato de colher que
 * pode deixar o conjunto cego — e um golden set cego não avisa; ele passa.
 *
 * A cobertura conta pelo ALVO, nunca pelo filtro do caso: foi assim que os números da spec foram
 * medidos (23 alvos `operations-center`, zero `code`), e por filtro dariam 27 e 1 — aquele `1` era
 * justamente um caso incoerente, que teria satisfeito em silêncio a asserção criada para forçar o
 * caso `source: code` escrito à mão.
 */
export function conferirCobertura(casos, docs) {
  const problemas = [];
  if (casos.length < MINIMO) {
    problemas.push(`só ${casos.length} casos; o mínimo do CA2 é ${MINIMO}.`);
  }

  const positivos = casos.filter((c) => c.tipo !== "negativo");
  const alvos = [];
  for (const c of positivos) {
    const achados = resolverAlvo(c, docs);
    if (!achados.length) {
      // Colhido insatisfazível já foi descartado lá atrás; se um chega aqui, é manual — e manual
      // não se redescobre sozinho na próxima colheita. Silêncio aqui apodreceria o portão.
      problemas.push(
        `caso ${c.origem} sem alvo que satisfaça os próprios filtros: ${JSON.stringify(c.esperado)} ` +
          `${JSON.stringify(c.filtros)} — "${c.q}"`
      );
      continue;
    }
    alvos.push(...achados);
  }

  if (!alvos.some((d) => d.source === "code")) {
    problemas.push("nenhum caso cujo alvo seja source: code — a telemetria não produz esse caso, ele é escrito à mão.");
  }
  if (!alvos.some((d) => d.repo === "operations-center")) {
    problemas.push("nenhum caso cujo alvo esteja no repo operations-center.");
  }

  const negativos = casos.filter((c) => c.tipo === "negativo");
  if (negativos.length < 2) {
    problemas.push(`${negativos.length} caso(s) negativo(s); o CA2 pede 2.`);
  } else {
    // Os dois sabores existem por motivos opostos, e ter dois do mesmo sabor é não ter cobertura: o
    // estrutural nunca falha por mudança de ranking, e o volátil é o que ensina o eval a dizer "o
    // caso apodreceu" (código 2) em vez de "o ranking piorou" (código 1).
    if (!negativos.some((c) => c.volatil === false)) problemas.push("nenhum negativo ESTRUTURAL (volatil: false).");
    if (!negativos.some((c) => c.volatil === true)) problemas.push("nenhum negativo VOLÁTIL (volatil: true).");
  }

  return problemas;
}

// ---------------------------------------------------------------- CLI
const caminhoDb = () => process.env.BRAIN_DB || join(root, "data", "brain.db");
const caminhoGolden = () => process.env.BRAIN_GOLDEN || join(root, "scripts", "golden.json");

function fail(msg) {
  console.error(`\nCOLHEITA FALHOU: ${msg}`);
  process.exit(1);
}

function main() {
  const dbPath = caminhoDb();
  const goldenPath = caminhoGolden();
  if (!existsSync(dbPath)) fail(`banco não encontrado em ${dbPath}. Rode na instalação, ou aponte o BRAIN_DB.`);

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const atuais = existsSync(goldenPath) ? JSON.parse(readFileSync(goldenPath, "utf8")) : [];

  const { casos: colhidos, avisos, contagem, docs } = colher(db);
  for (const a of avisos) console.warn(`  aviso: ${a}`);

  const { casos, manuais, colhidos: mantidos } = mesclar(atuais, colhidos);
  const problemas = conferirCobertura(casos, docs);
  db.close();

  console.log(
    `\n${contagem.brutos} pares brutos · ${contagem.repetidas} repetidas · ${contagem.semAlvo} sem alvo · ` +
      `${contagem.incoerentes} incoerentes · ${contagem.semPar} buscas sem leitura na janela`
  );
  console.log(`${casos.length} casos: ${manuais} manuais preservados + ${mantidos} colhidos`);

  if (problemas.length) {
    for (const p of problemas) console.error(`  x ${p}`);
    // Não escreve. O golden.json versionado é a ENTRADA do portão: uma colheita magra que
    // sobrescrevesse o arquivo (um clone novo, com `uso` vazio) apagaria o conjunto inteiro e
    // deixaria o portão sem o que medir — exatamente quando ninguém está olhando.
    fail(`${problemas.length} problema(s) de cobertura. ${goldenPath} NÃO foi tocado.`);
  }

  writeFileSync(goldenPath, JSON.stringify(casos, null, 2) + "\n");
  console.log(`\nCOLHEITA OK -> ${goldenPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

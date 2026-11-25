// Medição do critério 4 do #46: a marca "contradição provável" do Jev acerta as substituições que
// o cofre já registrou? Quantas marcas não correspondem a nenhuma substituição? Quanto tempo o
// julgamento soma ao `lembrar`?
//
//   npm run contradicao                  # só diz o que mandaria; sai 2 e não chama o juiz
//   npm run contradicao -- --enviar      # manda o `fato` dos pares ao Jev (TypeSafe AI)
//   npm run contradicao -- --enviar --max-novas 20
//
// Dois portões, e os dois precisam estar abertos: a flag do Jev (#42) ligada E o `--enviar`. Uma
// rodada com o padrão manda o `fato` de até 80 decisões novas e de até 400 vizinhas para um
// serviço externo pago; sem a autorização de Leonardo isso não acontece por acidente.
//
// Só lê: mede sobre um SNAPSHOT do índice (`VACUUM INTO`, o mesmo do eval) e o apaga no fim. Nunca
// grava no índice vivo e não chama o `lembrar`.
//
// Códigos de saída: 0 mediu; 2 não mediu (portão fechado ou exceção). Não há código 1: isto não é
// portão de PR, é medição pontual.
//
// `process.exit` no fim, sempre: um cliente que não honra o `AbortSignal` deixaria o processo vivo
// com a chamada em segundo plano (mesmo molde do eval.mjs).
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tirarSnapshot, limpar } from "./eval.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const modulo = (nome) => import(pathToFileURL(join(raiz, "dist", nome)).href);

const MAX_NOVAS_PADRAO = 40;
const TETO_VIZINHAS = 5;
const CANDIDATAS_POR_NOVA = 300; // o LIMIT de decisoesRelacionadas (memoria.ts)

function lerArgumentos(argv) {
  const enviar = argv.includes("--enviar");
  const i = argv.indexOf("--max-novas");
  const bruto = i === -1 ? undefined : argv[i + 1];
  // Qualquer valor que não seja inteiro positivo volta ao padrão, como o prazo do lembrar.
  const maxNovas = bruto !== undefined && /^\d+$/.test(bruto) && Number(bruto) > 0 ? Number(bruto) : MAX_NOVAS_PADRAO;
  return { enviar, maxNovas };
}

/** Reproduz `decisoesRelacionadas` no passado da decisão `nova`, sobre o snapshot. */
function vizinhasNoPassado(db, nova, { cosseno, deBlob, limiar }) {
  const candidatas = db
    .prepare(
      `SELECT id, data, escopo, fato, embedding FROM decisoes
       WHERE id < ? AND (? IS NULL OR escopo = ? OR escopo IS NULL)
       ORDER BY ts DESC LIMIT ${CANDIDATAS_POR_NOVA}`
    )
    .all(nova.id, nova.escopo ?? null, nova.escopo ?? null);
  const embeddingNova = deBlob(nova.embedding);
  return candidatas
    .filter((c) => c.embedding)
    .map((c) => ({
      id: c.id,
      data: c.data,
      escopo: c.escopo,
      fato: c.fato,
      semelhanca: cosseno(embeddingNova, deBlob(c.embedding)),
    }))
    .filter((c) => c.semelhanca >= limiar)
    .sort((a, b) => b.semelhanca - a.semelhanca)
    .slice(0, TETO_VIZINHAS);
}

/** Percentil por posto mais próximo, arredondado para inteiro; sem amostra, `-`. */
function percentil(valores, p) {
  if (valores.length === 0) return "-";
  const ordenados = [...valores].sort((a, b) => a - b);
  const posto = Math.max(1, Math.ceil((p / 100) * ordenados.length));
  return String(Math.round(ordenados[posto - 1]));
}

async function medir(argumentos, estado) {
  const { dbPath } = await modulo("config.js");
  const { cosseno, deBlob } = await modulo("embeddings.js");
  const { LIMIAR_MESMO_ASSUNTO } = await modulo("memoria.js");
  const { julgarContradicoes } = await modulo("contradicao.js");

  estado.snapshot = tirarSnapshot(dbPath);
  const db = new DatabaseSync(estado.snapshot.arquivo, { readOnly: true });
  try {
    const regra = { cosseno, deBlob, limiar: LIMIAR_MESMO_ASSUNTO };

    // Amostra: as substituições conhecidas (positivas) e decisões comuns com vizinha (neutras).
    const colunas = "id, data, escopo, fato, supersede, embedding";
    const positivas = db
      .prepare(`SELECT ${colunas} FROM decisoes WHERE embedding IS NOT NULL AND supersede IS NOT NULL ORDER BY id DESC LIMIT ?`)
      .all(argumentos.maxNovas)
      .map((nova) => ({ nova, vizinhas: vizinhasNoPassado(db, nova, regra) }));

    const neutras = [];
    const candidatasNeutras = db
      .prepare(`SELECT ${colunas} FROM decisoes WHERE embedding IS NOT NULL AND supersede IS NULL ORDER BY id DESC`)
      .iterate();
    for (const nova of candidatasNeutras) {
      const vizinhas = vizinhasNoPassado(db, nova, regra);
      if (vizinhas.length === 0) continue;
      neutras.push({ nova, vizinhas });
      if (neutras.length >= argumentos.maxNovas) break;
    }

    const amostra = [...positivas, ...neutras];
    const comVizinhas = amostra.filter((a) => a.vizinhas.length > 0);
    const paresPossiveis = comVizinhas.reduce((soma, a) => soma + a.vizinhas.length, 0);

    // Portão 1: `--enviar`. Só com ele o juiz sequer é construído.
    let julgar = null;
    let motivo = "falta --enviar";
    if (argumentos.enviar) {
      const { obterJulgarPar } = await modulo("juizJev.js");
      julgar = await obterJulgarPar();
      // Portão 2: a flag do Jev (#42).
      if (julgar === null) motivo = "o Jev está desligado (flag ou chave ausente)";
    }
    if (julgar === null) {
      console.log(`não enviei nada: ${motivo}`);
      console.log(`mandaria ${paresPossiveis} pares de ${comVizinhas.length} decisões novas (só o campo fato)`);
      return 2;
    }

    let falhas = 0;
    let paresJulgados = 0;
    let substituicoesNaLista = 0;
    let acertos = 0;
    let foraDaLista = 0;
    let inventadas = 0;
    const latencias = [];

    for (const { nova, vizinhas } of amostra) {
      const positiva = nova.supersede !== null;
      if (vizinhas.length === 0) {
        // O Jev nunca veria a substituída: conta como fora da lista, sem chamar o juiz.
        if (positiva) foraDaLista++;
        continue;
      }
      const inicio = performance.now();
      const marcas = await julgarContradicoes(nova.fato, vizinhas, julgar);
      const levou = performance.now() - inicio;
      if (marcas === null) {
        falhas++;
        continue;
      }
      latencias.push(levou);
      paresJulgados += vizinhas.length;
      if (positiva) {
        if (vizinhas.some((v) => v.id === nova.supersede)) {
          substituicoesNaLista++;
          if (marcas.has(nova.supersede)) acertos++;
        } else {
          foraDaLista++;
        }
      }
      for (const id of marcas.keys()) if (id !== nova.supersede) inventadas++;
    }

    const kPositivas = positivas.length;
    console.log(
      `decisões novas: ${amostra.length} (${kPositivas} com substituição, ${neutras.length} sem) · ` +
        `pares julgados: ${paresJulgados} · sem julgamento (erro ou prazo): ${falhas}`
    );
    console.log(
      `substituições na lista: ${substituicoesNaLista} · marcadas (acertos): ${acertos} · ` +
        `não marcadas (perdidas): ${substituicoesNaLista - acertos} · fora da lista: ${foraDaLista}`
    );
    console.log(
      `marcas sem substituição (teto das inventadas): ${inventadas} de ${paresJulgados - substituicoesNaLista} pares`
    );
    console.log(
      `latência somada ao lembrar (ms): p50 ${percentil(latencias, 50)} · p95 ${percentil(latencias, 95)} · máx ${percentil(latencias, 100)}`
    );
    console.log('limitação: "inventada" é teto — o rótulo é a falta de supersede, e há contradição que ninguém registrou');
    console.log("limitação: supersedida_por no momento de cada gravação não é recuperável e foi ignorado");
    return 0;
  } finally {
    db.close();
  }
}

const estado = { snapshot: null };
let codigo = 2;
try {
  codigo = await medir(lerArgumentos(process.argv.slice(2)), estado);
} catch (err) {
  console.error(`contradicao: não consegui medir: ${err?.stack ?? err}`);
  codigo = 2;
} finally {
  limpar(estado.snapshot?.dir);
  // Sem isto um cliente que ignora o AbortSignal seguraria o processo com a chamada pendente.
  process.exit(codigo);
}

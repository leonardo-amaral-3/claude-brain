#!/usr/bin/env node
// Cliente unico do Jev (TypeSafe AI) do claude-brain. CommonJS, sem dependencia.
//
// Por que existe: seis consumidores (#41 triagem, #42 filtro do hook, #43 spec, #44 parada,
// #45 roteador, #46 lembrar) precisam do mesmo julgamento sim/nao com probabilidade. Um cliente
// so evita seis maneiras diferentes de ligar, de falhar e de nao vazar a chave.
//
// O CONTRATO ABAIXO E ESTAVEL: a fonte e planning/42-filtro-jev/spec.md, secao "Contrato do
// cliente do Jev (estavel)". Mudar qualquer item e emenda daquela spec. Quem quiser mudar URL,
// modelo ou formato do corpo mexe so no adaptador real (`consultarApi`), nunca no contrato.
//
// ---------------------------------------------------------------------------------------------
// Onde mora e como se alcanca
//   Fonte: hooks/jev.js. Instalado em <CLAUDE_HOME>/hooks/jev.js, com
//   CLAUDE_HOME = $CLAUDE_CONFIG_DIR || ~/.claude.
//   Hook (CJS):      require('./jev.js'), dentro de try, so depois de conferir o uso na env.
//   brain-mcp / scripts / skills com script (ESM): createRequire(import.meta.url)(caminho),
//     dentro de try, 1o `<raiz>/../hooks/jev.js` se existir (layout do repo), 2o
//     `<CLAUDE_HOME>/hooks/jev.js` (layout da instalacao). Falha ao carregar = `desligado`.
//   Skills (Bash):   node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/jev.js" (JSON na stdin e na stdout).
//
// Usos (valores fechados; uso novo e emenda da spec):
//   contexto #42 | triagem #41 | spec #43 | parada #44 | roteador #45 | lembrar #46
//
// Ambiente (lido a CADA chamada, de opcoes.env ?? process.env; nunca ao carregar o modulo):
//   BRAIN_JEV         lista de usos ligados, separados por virgula, com trim e minusculas. Sem
//                     curinga: `1`, `*` e `todos` nao ligam nada. Ausente = tudo desligado.
//   TYPESAFE_API_KEY  a chave. Nunca em arquivo do repo nem de config.
//   BRAIN_JEV_FALSO   cliente falso. DEFINIDA, mesmo vazia, o real nunca roda.
//
// Ordem de decisao por chamada (a primeira que casa vence, para todas as chaves; emenda 2):
//   1. uso fora da tabela                  -> entrada_invalida
//   2. uso fora de BRAIN_JEV               -> desligado
//   3. validacao da entrada                -> entrada_invalida
//   4. BRAIN_JEV_FALSO !== undefined       -> cliente falso
//   5. TYPESAFE_API_KEY vazia ou ausente   -> sem_chave
//   6. adaptador real
//   A validacao vem antes do falso para o falso nunca aprovar o que o real recusaria: e o falso
//   que os portoes rodam, e um `ok` que o real nao daria esconderia o filtro desligado.
//
// Funcoes (module.exports = { ligado, decidir, julgar, envSemJev, ...constantes }):
//   ligado(uso, env?)                       -> boolean, sem I/O
//   envSemJev(env)                          -> copia sem TYPESAFE_API_KEY e sem chave BRAIN_JEV*
//   decidir(estado, perguntas, opcoes)      -> Promise<Record<id, RespostaNoul|RespostaEscolha|Indisponivel>>
//   julgar(pergunta, trechos, opcoes)       -> Promise<Array<RespostaNoul|Indisponivel>>
//
// Garantias de decidir e julgar: nunca rejeitam nem lancam, nunca fazem retry, resolvem em ate
// timeoutMs + 50 ms, nao escrevem em stdout nem em stderr. Carregar o modulo tambem nao escreve
// nada; so o modo CLI escreve, e so a linha do envelope.
//
// CLI (require.main === module): stdin {"op":"decidir"|"julgar","uso":...}, stdout UMA linha
//   {"ok":true,"resultado":...} ou {"ok":false,"motivo":"entrada_invalida"}; exit 0 sempre que o
//   envelope foi escrito. Regra do consumidor: stdout que nao e JSON, envelope sem `ok`, exit != 0
//   ou jev.js ausente valem `indisponivel` em tudo o que se perguntou (fail-closed).
//
// Cliente falso (BRAIN_JEV_FALSO definida e uso ligado; nunca chama fetch):
//   sim | nao | indisponivel | lento | <caminho de um roteiro JSON> (vazio/ilegivel = resposta_invalida)
// ---------------------------------------------------------------------------------------------

'use strict';

const fs = require('fs');

/** @typedef {'contexto'|'triagem'|'spec'|'parada'|'roteador'|'lembrar'} Uso */
/** @typedef {{ id: string, texto: string, titulo?: string, fonte?: string }} Trecho
 *  id: identifica o trecho para quem chama (o hook usa o caminho). NUNCA e enviado ao Jev. */
/** @typedef {{ tipo: 'noul', instrucao: string }
 *          | { tipo: 'escolha', instrucao: string, opcoes: Record<string, string> }} Pergunta
 *  opcoes: nome -> descricao, 1 a 255 entradas. */
/** @typedef {'desligado'|'sem_chave'|'timeout'|'http'|'rede'|'resposta_invalida'|'entrada_invalida'} Motivo */
/** @typedef {{ estado: 'ok', tipo: 'noul', sim: boolean, probabilidade: number }} RespostaNoul
 *  probabilidade = P(sim) em [0,1]; sim = probabilidade >= 0.5. O limiar de decisao e de quem chama. */
/** @typedef {{ estado: 'ok', tipo: 'escolha', escolha: string, confianca: number,
 *              probabilidades: Record<string, number> }} RespostaEscolha
 *  escolha esta em opcoes; probabilidades tem exatamente as chaves de opcoes. */
/** @typedef {{ estado: 'indisponivel', motivo: Motivo, detalhe?: string }} Indisponivel
 *  detalhe: status HTTP ('429') ou frase curta. Nunca contem a chave nem o corpo enviado. */
/** @typedef {{ uso: Uso, timeoutMs?: number, env?: Record<string,string|undefined>,
 *              fetch?: typeof fetch, instrucao?: string }} Opcoes   // uso e OBRIGATORIO */

const TIMEOUT_MS = 2000;
const MAX_TEXTO = 4000;
const MAX_PERGUNTA = 4000;
const MAX_ESTADO = 200000;
const MAX_TRECHOS = 16;
const USOS = ['contexto', 'triagem', 'spec', 'parada', 'roteador', 'lembrar'];
const INSTRUCAO_PADRAO = 'O trecho é relevante para responder ou executar a pergunta?';

const MOTIVOS = ['desligado', 'sem_chave', 'timeout', 'http', 'rede', 'resposta_invalida', 'entrada_invalida'];

// Adaptador real (premissa A1 da spec: formato lido da documentacao publica, nao verificado
// contra a API). Tudo que depende do fornecedor fica daqui ate `consultarApi`.
const URL_API = 'https://api.typesafe.ai/v1/systemone';
const MODELO = 'jev-latest';

const tem = (objeto, chave) => Object.prototype.hasOwnProperty.call(objeto, chave);
const ehObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const ehProbabilidade = (valor) => typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 1;

function indisponivel(motivo, detalhe) {
  return detalhe === undefined ? { estado: 'indisponivel', motivo } : { estado: 'indisponivel', motivo, detalhe };
}

function envDe(opcoes) {
  return (opcoes && opcoes.env) || process.env;
}

// timeoutMs sem teto: qualquer finito > 0 vale (o #46 usa 4000). Fora disso, o padrao.
function prazoDe(opcoes) {
  const pedido = opcoes && opcoes.timeoutMs;
  return typeof pedido === 'number' && Number.isFinite(pedido) && pedido > 0 ? pedido : TIMEOUT_MS;
}

function usosLigados(env) {
  const lista = env.BRAIN_JEV;
  if (typeof lista !== 'string') return [];
  return lista.split(',').map((item) => item.trim().toLowerCase());
}

function chaveDaApi(env) {
  return typeof env.TYPESAFE_API_KEY === 'string' ? env.TYPESAFE_API_KEY : '';
}

/**
 * Vale true sse o uso esta na tabela, esta em BRAIN_JEV, e ha como responder: o falso definido
 * ou uma chave nao vazia. Sem I/O.
 * @param {Uso} uso
 * @param {Record<string,string|undefined>} [env]
 */
function ligado(uso, env) {
  const ambiente = env || process.env;
  if (!USOS.includes(uso)) return false;
  if (!usosLigados(ambiente).includes(uso)) return false;
  return ambiente.BRAIN_JEV_FALSO !== undefined || chaveDaApi(ambiente) !== '';
}

/**
 * Copia de `env` sem a chave e sem toda variavel BRAIN_JEV*. E o que todo script de teste ou
 * medicao passa a processo filho que possa carregar o cliente: a chave nao vaza por heranca.
 * @param {Record<string,string|undefined>} env
 */
function envSemJev(env) {
  const copia = {};
  for (const nome of Object.keys(env || {})) {
    if (nome === 'TYPESAFE_API_KEY' || nome.startsWith('BRAIN_JEV')) continue;
    copia[nome] = env[nome];
  }
  return copia;
}

// Passos 1 e 2 da ordem de decisao: devolve o motivo que vale para todas as chaves, ou null.
function barreiraDeUso(opcoes) {
  const uso = opcoes && opcoes.uso;
  if (!USOS.includes(uso)) return 'entrada_invalida';
  if (!usosLigados(envDe(opcoes)).includes(uso)) return 'desligado';
  return null;
}

// --- Cliente falso ---------------------------------------------------------------------------

// Normalizacao do `eval.mjs` (`norm`): caixa baixa e barra normal, para o roteiro casar caminho
// de Windows e de Linux do mesmo jeito.
const normalizarCaminho = (texto) => String(texto).toLowerCase().replace(/\\/g, '/');

function respostaNoulFalsa(probabilidade) {
  return { estado: 'ok', tipo: 'noul', sim: probabilidade >= 0.5, probabilidade };
}

function respostaEscolhaFalsa(opcoes, escolha, confianca) {
  const nomes = Object.keys(opcoes);
  const resto = nomes.length > 1 ? (1 - confianca) / (nomes.length - 1) : 0;
  const probabilidades = {};
  for (const nome of nomes) probabilidades[nome] = nome === escolha ? confianca : resto;
  return { estado: 'ok', tipo: 'escolha', escolha, confianca, probabilidades };
}

function respostaFixaFalsa(modo, pergunta) {
  if (pergunta.tipo === 'noul') return respostaNoulFalsa(modo === 'sim' ? 0.95 : 0.05);
  const nomes = Object.keys(pergunta.opcoes);
  const primeira = nomes[0];
  if (modo === 'sim') return respostaEscolhaFalsa(pergunta.opcoes, primeira, nomes.length === 1 ? 1 : 0.95);
  // `nao`: sem opiniao, probabilidades uniformes
  const uniforme = 1 / nomes.length;
  const probabilidades = {};
  for (const nome of nomes) probabilidades[nome] = uniforme;
  return { estado: 'ok', tipo: 'escolha', escolha: primeira, confianca: uniforme, probabilidades };
}

function lerRoteiro(caminho) {
  try {
    const roteiro = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    if (!ehObjeto(roteiro)) return null;
    if (roteiro.regras !== undefined && !Array.isArray(roteiro.regras)) return null;
    return roteiro;
  } catch (_) {
    return null;
  }
}

function regraCasa(quando, contexto) {
  if (quando === undefined) return true;
  if (!ehObjeto(quando)) return false;
  if (quando.pergunta !== undefined) {
    // com `estado` que nao e string (decidir), `pergunta` nunca casa
    if (typeof contexto.pergunta !== 'string' || quando.pergunta !== contexto.pergunta) return false;
  }
  if (quando.trechoId !== undefined) {
    // no `decidir` nao ha trecho: a regra nao casa
    if (typeof contexto.trechoId !== 'string') return false;
    if (!normalizarCaminho(contexto.trechoId).includes(normalizarCaminho(quando.trechoId))) return false;
  }
  if (quando.id !== undefined && quando.id !== contexto.id) return false;
  return true;
}

function respostaDeRoteiro(roteiro, pergunta, contexto) {
  const invalida = indisponivel('resposta_invalida', 'roteiro');
  const regra = (roteiro.regras || []).find((candidata) => ehObjeto(candidata) && regraCasa(candidata.quando, contexto));
  const responde = regra ? regra.responde : roteiro.padrao;
  if (!ehObjeto(responde)) return invalida;
  if (responde.indisponivel !== undefined) {
    return MOTIVOS.includes(responde.indisponivel) ? indisponivel(responde.indisponivel, 'falso') : invalida;
  }
  if (pergunta.tipo === 'noul') {
    return ehProbabilidade(responde.probabilidade) ? respostaNoulFalsa(responde.probabilidade) : invalida;
  }
  if (typeof responde.escolha !== 'string' || !tem(pergunta.opcoes, responde.escolha)) return invalida;
  const confianca = responde.confianca === undefined ? 0.95 : responde.confianca;
  if (!ehProbabilidade(confianca)) return invalida;
  return respostaEscolhaFalsa(pergunta.opcoes, responde.escolha, confianca);
}

// `itens`: [{chave, pergunta, contexto}]. Devolve [{chave, resposta}] sem tocar a rede.
// O `lento` espera o prazo inteiro, como a API lenta de verdade, e entao vira `timeout`.
async function responderFalso(modo, itens, timeoutMs) {
  if (modo === 'lento') {
    await new Promise((resolver) => setTimeout(resolver, timeoutMs));
    return itens.map((item) => ({ chave: item.chave, resposta: indisponivel('timeout', 'falso') }));
  }
  if (modo === 'indisponivel') {
    return itens.map((item) => ({ chave: item.chave, resposta: indisponivel('rede', 'falso') }));
  }
  if (modo === 'sim' || modo === 'nao') {
    return itens.map((item) => ({ chave: item.chave, resposta: respostaFixaFalsa(modo, item.pergunta) }));
  }
  // qualquer outro valor, inclusive vazio, e o caminho de um roteiro
  const roteiro = lerRoteiro(modo);
  return itens.map((item) => ({
    chave: item.chave,
    resposta: roteiro ? respostaDeRoteiro(roteiro, item.pergunta, item.contexto) : indisponivel('resposta_invalida', 'roteiro'),
  }));
}

// --- Adaptador real --------------------------------------------------------------------------

// Prazo unico: um AbortController + setTimeout (nao o atalho de sinal com prazo pronto, cujo timer nao segura o
// event loop). Alem de abortar, o prazo resolve uma promessa, para o `fetch` que ignora o sinal
// nao passar de timeoutMs + 50 ms.
function criarPrazo(timeoutMs) {
  const controle = new AbortController();
  let estourou = false;
  let aoEstourar;
  const promessa = new Promise((resolver) => {
    aoEstourar = resolver;
  });
  const temporizador = setTimeout(() => {
    estourou = true;
    controle.abort();
    aoEstourar();
  }, timeoutMs);
  return {
    sinal: controle.signal,
    estourou: () => estourou,
    promessaDoPrazo: promessa,
    limpar: () => clearTimeout(temporizador),
  };
}

function perguntaParaApi(pergunta) {
  return pergunta.tipo === 'noul'
    ? { type: 'noul', instructions: pergunta.instrucao }
    : { type: 'choice', instructions: pergunta.instrucao, criteria: pergunta.opcoes };
}

function interpretarResposta(pergunta, bruta) {
  const invalida = indisponivel('resposta_invalida');
  if (!ehObjeto(bruta)) return invalida;
  if (pergunta.tipo === 'noul') {
    return ehProbabilidade(bruta.noul) ? respostaNoulFalsa(bruta.noul) : invalida;
  }
  if (typeof bruta.choice !== 'string' || !tem(pergunta.opcoes, bruta.choice)) return invalida;
  if (!ehProbabilidade(bruta.confidence) || !ehObjeto(bruta.probabilities)) return invalida;
  const probabilidades = {};
  for (const nome of Object.keys(pergunta.opcoes)) {
    const valor = tem(bruta.probabilities, nome) ? bruta.probabilities[nome] : 0;
    if (!ehProbabilidade(valor)) return invalida;
    probabilidades[nome] = valor;
  }
  return { estado: 'ok', tipo: 'escolha', escolha: bruta.choice, confianca: bruta.confidence, probabilidades };
}

// Uma requisicao ao Jev. Devolve {respostas: answers} ou {falha: Indisponivel}; nunca lanca.
async function consultarApi(estado, perguntas, chave, enviar, prazo) {
  const questions = {};
  for (const id of Object.keys(perguntas)) questions[id] = perguntaParaApi(perguntas[id]);
  try {
    const res = await enviar(URL_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELO, state: estado, questions }),
      signal: prazo.sinal,
    });
    if (!res.ok) return { falha: indisponivel('http', String(res.status)) };
    let corpo;
    try {
      corpo = await res.json();
    } catch (_) {
      return { falha: prazo.estourou() ? indisponivel('timeout') : indisponivel('resposta_invalida') };
    }
    if (!corpo || !ehObjeto(corpo.answers)) return { falha: indisponivel('resposta_invalida') };
    return { respostas: corpo.answers };
  } catch (_) {
    return { falha: prazo.estourou() ? indisponivel('timeout') : indisponivel('rede') };
  }
}

// Corre a requisicao contra o prazo comum; o que nao terminou ate la vira `timeout`.
async function consultarComPrazo(estado, perguntas, chave, enviar, prazo) {
  const sentinela = Symbol('prazo');
  const resultado = await Promise.race([
    consultarApi(estado, perguntas, chave, enviar, prazo),
    prazo.promessaDoPrazo.then(() => sentinela),
  ]);
  if (resultado === sentinela) return { falha: indisponivel('timeout') };
  return resultado;
}

function respostasPorChave(perguntas, resultado) {
  const saida = {};
  for (const id of Object.keys(perguntas)) {
    if (resultado.falha) saida[id] = resultado.falha;
    else saida[id] = interpretarResposta(perguntas[id], tem(resultado.respostas, id) ? resultado.respostas[id] : undefined);
  }
  return saida;
}

// --- Validacao -------------------------------------------------------------------------------

function perguntaValida(pergunta) {
  if (!ehObjeto(pergunta) || typeof pergunta.instrucao !== 'string') return false;
  if (pergunta.tipo === 'noul') return true;
  if (pergunta.tipo !== 'escolha') return false;
  if (!ehObjeto(pergunta.opcoes)) return false;
  const quantidade = Object.keys(pergunta.opcoes).length;
  return quantidade >= 1 && quantidade <= 255;
}

function tamanhoDoEstado(estado) {
  try {
    const texto = JSON.stringify(estado);
    return typeof texto === 'string' ? texto.length : null;
  } catch (_) {
    return null; // circular, BigInt...: nao ha como enviar
  }
}

function paraTodasAsChaves(perguntas, resposta) {
  const saida = {};
  for (const id of Object.keys(perguntas)) saida[id] = resposta;
  return saida;
}

// --- API publica -----------------------------------------------------------------------------

/**
 * Uma requisicao, varias perguntas `noul`/`escolha` sobre um estado: a primitiva do Jev.
 * O resultado tem exatamente as chaves de `perguntas`.
 * @param {string|object} estado
 * @param {Record<string, Pergunta>} perguntas
 * @param {Opcoes} opcoes
 * @returns {Promise<Record<string, RespostaNoul|RespostaEscolha|Indisponivel>>}
 */
async function decidir(estado, perguntas, opcoes) {
  try {
    if (!ehObjeto(perguntas)) return {};
    const barreira = barreiraDeUso(opcoes);
    if (barreira) return paraTodasAsChaves(perguntas, indisponivel(barreira));
    const env = envDe(opcoes);
    const timeoutMs = prazoDe(opcoes);

    // 3. validacao, antes do falso (emenda 2)
    const ids = Object.keys(perguntas);
    const tamanho = tamanhoDoEstado(estado);
    if (ids.length === 0 || tamanho === null || tamanho > MAX_ESTADO || !ids.every((id) => perguntaValida(perguntas[id]))) {
      return paraTodasAsChaves(perguntas, indisponivel('entrada_invalida'));
    }

    if (env.BRAIN_JEV_FALSO !== undefined) {
      const itens = ids.map((id) => ({
        chave: id,
        pergunta: perguntas[id],
        contexto: { pergunta: typeof estado === 'string' ? estado : undefined, trechoId: undefined, id },
      }));
      const respostas = await responderFalso(env.BRAIN_JEV_FALSO, itens, timeoutMs);
      const saida = {};
      for (const { chave, resposta } of respostas) saida[chave] = resposta;
      return saida;
    }

    const chave = chaveDaApi(env);
    if (chave === '') return paraTodasAsChaves(perguntas, indisponivel('sem_chave'));

    const prazo = criarPrazo(timeoutMs);
    try {
      const enviar = (opcoes && opcoes.fetch) || globalThis.fetch;
      return respostasPorChave(perguntas, await consultarComPrazo(estado, perguntas, chave, enviar, prazo));
    } finally {
      prazo.limpar();
    }
  } catch (_) {
    // rede de seguranca da garantia "nunca lanca"
    return ehObjeto(perguntas) ? paraTodasAsChaves(perguntas, indisponivel('resposta_invalida', 'interno')) : {};
  }
}

/**
 * Uma pergunta e N trechos: uma requisicao por trecho, em paralelo, sob um prazo unico.
 * Mesmo tamanho e ordem de `trechos`.
 * @param {string} pergunta
 * @param {Trecho[]} trechos
 * @param {Opcoes} opcoes
 * @returns {Promise<Array<RespostaNoul|Indisponivel>>}
 */
async function julgar(pergunta, trechos, opcoes) {
  try {
    if (!Array.isArray(trechos) || trechos.length === 0) return [];
    const todos = (resposta) => trechos.map(() => resposta);
    const barreira = barreiraDeUso(opcoes);
    if (barreira) return todos(indisponivel(barreira));
    const env = envDe(opcoes);
    const timeoutMs = prazoDe(opcoes);
    const instrucao = opcoes.instrucao === undefined || opcoes.instrucao === null ? INSTRUCAO_PADRAO : opcoes.instrucao;
    const perguntaNoul = { tipo: 'noul', instrucao };

    // 3. validacao, antes do falso (emenda 2). Por trecho: acima de MAX_TRECHOS, ou sem texto ou
    // sem id, o trecho volta `entrada_invalida` e nao sai nada dele, no falso e no real.
    if (typeof pergunta !== 'string' || typeof instrucao !== 'string') return todos(indisponivel('entrada_invalida'));
    const enviavel = trechos.map(
      (trecho, indice) =>
        indice < MAX_TRECHOS && ehObjeto(trecho) && typeof trecho.id === 'string' && typeof trecho.texto === 'string' && trecho.texto !== ''
    );

    if (env.BRAIN_JEV_FALSO !== undefined) {
      const itens = [];
      trechos.forEach((trecho, indice) => {
        if (enviavel[indice]) itens.push({ chave: indice, pergunta: perguntaNoul, contexto: { pergunta, trechoId: trecho.id, id: 'relevante' } });
      });
      const saida = todos(indisponivel('entrada_invalida'));
      const respostas = itens.length ? await responderFalso(env.BRAIN_JEV_FALSO, itens, timeoutMs) : [];
      for (const { chave, resposta } of respostas) saida[chave] = resposta;
      return saida;
    }

    const chave = chaveDaApi(env);
    if (chave === '') return todos(indisponivel('sem_chave'));

    const perguntaCortada = pergunta.slice(0, MAX_PERGUNTA);
    const prazo = criarPrazo(timeoutMs);
    try {
      const enviar = opcoes.fetch || globalThis.fetch;
      return await Promise.all(
        trechos.map(async (trecho, indice) => {
          if (!enviavel[indice]) return indisponivel('entrada_invalida');
          // `id` nunca vai ao Jev: e so o rotulo de quem chama (o hook usa o caminho do arquivo)
          const dadosDoTrecho = { texto: trecho.texto.slice(0, MAX_TEXTO) };
          if (typeof trecho.titulo === 'string') dadosDoTrecho.titulo = trecho.titulo;
          if (typeof trecho.fonte === 'string') dadosDoTrecho.fonte = trecho.fonte;
          const perguntas = { relevante: perguntaNoul };
          const resultado = await consultarComPrazo({ pergunta: perguntaCortada, trecho: dadosDoTrecho }, perguntas, chave, enviar, prazo);
          return respostasPorChave(perguntas, resultado).relevante;
        }),
      );
    } finally {
      prazo.limpar();
    }
  } catch (_) {
    return Array.isArray(trechos) ? trechos.map(() => indisponivel('resposta_invalida', 'interno')) : [];
  }
}

// --- CLI -------------------------------------------------------------------------------------

const ENVELOPE_INVALIDO = { ok: false, motivo: 'entrada_invalida' };
let envelopeEscrito = false;

function escreverEnvelope(envelope) {
  if (envelopeEscrito) return; // uma linha so, mesmo que algo falhe depois de escrever
  envelopeEscrito = true;
  process.stdout.write(JSON.stringify(envelope) + '\n');
  process.exitCode = 0;
}

async function executarCli() {
  let envelope;
  try {
    // A leitura da stdin fica dentro do try: um erro no pipe vira o envelope, nao um stack trace.
    let entrada = '';
    process.stdin.setEncoding('utf8');
    for await (const pedaco of process.stdin) entrada += pedaco;
    const pedido = JSON.parse(entrada);
    if (!ehObjeto(pedido)) {
      envelope = ENVELOPE_INVALIDO;
    } else if (pedido.op === 'decidir') {
      envelope = { ok: true, resultado: await decidir(pedido.estado, pedido.perguntas, { uso: pedido.uso, timeoutMs: pedido.timeoutMs }) };
    } else if (pedido.op === 'julgar') {
      envelope = {
        ok: true,
        resultado: await julgar(pedido.pergunta, pedido.trechos, { uso: pedido.uso, instrucao: pedido.instrucao, timeoutMs: pedido.timeoutMs }),
      };
    } else {
      envelope = ENVELOPE_INVALIDO;
    }
  } catch (_) {
    envelope = ENVELOPE_INVALIDO;
  }
  escreverEnvelope(envelope);
}

if (require.main === module) {
  executarCli().catch(() => escreverEnvelope(ENVELOPE_INVALIDO));
}

module.exports = {
  ligado,
  decidir,
  julgar,
  envSemJev,
  TIMEOUT_MS,
  MAX_TEXTO,
  MAX_PERGUNTA,
  MAX_ESTADO,
  MAX_TRECHOS,
  USOS,
  INSTRUCAO_PADRAO,
};

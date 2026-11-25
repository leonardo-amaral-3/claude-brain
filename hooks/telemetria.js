'use strict';
// Gravador do diario de telemetria do brain (claude-brain#66, F1). O contrato do evento e
// `planning/66-telemetria/spec.md` § Contrato do evento: nao mude campo aqui sem emenda la.
//
// E o UNICO modulo que escreve no diario. Quem o chama: hooks/brain-contexto.js (evento `contexto`)
// e hooks/jev.js (evento `jev`). O painel e os scripts so leem.
//
// Garantias: CommonJS sem dependencia; nunca escreve em stdout nem stderr; nunca lanca.
// Opt-in: sem BRAIN_TELEMETRIA=1 nada e gravado (R3).
//
// Onde: <CLAUDE_HOME>/brain-telemetria/eventos-AAAA-MM-DD.jsonl (data UTC do ts), um arquivo por
// dia, fora do repo e fora do brain.db. Retencao de 90 dias, feita aqui, na criacao do arquivo do dia.

const fs = require('fs');
const os = require('os');
const path = require('path');

const VERSAO = 1;
const RETENCAO_DIAS = 90;
const MAX_LINHA = 8000;
const DIA_MS = 86400000;
const PADRAO_ARQUIVO = /^eventos-(\d{4}-\d{2}-\d{2})\.jsonl$/;

const dataUtc = (ts) => new Date(ts).toISOString().slice(0, 10);

/**
 * true sse env.BRAIN_TELEMETRIA === '1' e (env.BRAIN_JEV_FALSO === undefined ou
 * env.BRAIN_TELEMETRIA_DIR nao vazia).
 * Por que o falso desliga: todo teste do Jev roda com o falso; sem esta regra, um teste com
 * BRAIN_TELEMETRIA=1 herdada do shell gravaria no diario vivo. Teste que quer evento com o falso
 * define BRAIN_TELEMETRIA_DIR (um diretorio temporario), e ai grava.
 */
function ligada(env = process.env) {
  if (!env || env.BRAIN_TELEMETRIA !== '1') return false;
  if (env.BRAIN_JEV_FALSO === undefined) return true;
  return typeof env.BRAIN_TELEMETRIA_DIR === 'string' && env.BRAIN_TELEMETRIA_DIR !== '';
}

/** env.BRAIN_TELEMETRIA_DIR nao vazia, senao <CLAUDE_HOME>/brain-telemetria (regra de brain-config.js:24). */
function dirTelemetria(env = process.env) {
  if (env && typeof env.BRAIN_TELEMETRIA_DIR === 'string' && env.BRAIN_TELEMETRIA_DIR !== '') {
    return env.BRAIN_TELEMETRIA_DIR;
  }
  const home = (env && env.CLAUDE_CONFIG_DIR) || path.join(os.homedir(), '.claude');
  return path.join(home, 'brain-telemetria');
}

/** <dir>/eventos-<data UTC de ts>.jsonl */
function arquivoDoDia(ts, env = process.env) {
  return path.join(dirTelemetria(env), 'eventos-' + dataUtc(ts) + '.jsonl');
}

/** A linha serializada, com `v` primeiro; passou de MAX_LINHA bytes, sem itens/notas e com cortado:true. */
function montarLinha(evento) {
  // `v` primeiro e do gravador: o do chamador (se vier) nao vence. Reatribuir depois do spread
  // mantem a posicao da chave original, entao `v` do chamador no meio do objeto nao o desloca.
  const base = { v: VERSAO, ...evento };
  base.v = VERSAO;
  const linha = JSON.stringify(base);
  if (Buffer.byteLength(linha, 'utf8') <= MAX_LINHA) return linha;
  const menor = { ...base };
  // `itens` e array so no `contexto` (no `jev` e um inteiro e fica); `notas` so existe no `jev`.
  if (menor.evento === 'jev') delete menor.notas;
  else delete menor.itens;
  menor.cortado = true;
  return JSON.stringify(menor);
}

/**
 * Apaga os eventos-*.jsonl com data anterior a hoje_UTC - 90 dias (o de 90 dias atras fica, o de
 * 91 sai). So arquivos que casam PADRAO_ARQUIVO: gabarito/ e qualquer outro arquivo nunca sao
 * tocados. try por arquivo: falhar em apagar um nao impede o resto.
 */
function varrer(dir, ts) {
  const hoje = Date.parse(dataUtc(ts) + 'T00:00:00Z');
  const corte = dataUtc(hoje - RETENCAO_DIAS * DIA_MS);
  let nomes;
  try {
    nomes = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const nome of nomes) {
    const m = PADRAO_ARQUIVO.exec(nome);
    if (!m || m[1] >= corte) continue;
    try {
      fs.unlinkSync(path.join(dir, nome));
    } catch {
      /* segue com os demais */
    }
  }
}

/**
 * Grava { v: VERSAO, ...evento } numa linha (v primeiro). Devolve true se gravou; false se
 * desligada ou se falhou. Nunca lanca. Varias sessoes gravam ao mesmo tempo: o O_APPEND de uma
 * linha < 8000 bytes numa chamada so e o que se aceita; linha corrompida o leitor conta em `invalidas`.
 */
function gravar(evento, env = process.env) {
  try {
    if (!ligada(env)) return false;
    const linha = montarLinha(evento);
    const dir = dirTelemetria(env);
    const arq = arquivoDoDia(evento.ts, env);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const novo = !fs.existsSync(arq);
    fs.appendFileSync(arq, linha + '\n', { mode: 0o600 });
    if (novo) varrer(dir, evento.ts);
    return true;
  } catch {
    return false;
  }
}

module.exports = { ligada, dirTelemetria, arquivoDoDia, gravar, VERSAO, RETENCAO_DIAS, MAX_LINHA };

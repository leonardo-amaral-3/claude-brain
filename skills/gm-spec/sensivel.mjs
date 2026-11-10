#!/usr/bin/env node
// Portão da spec sensível do /gm-spec (card #43).
//
// Por quê: quem escreve a spec não deve julgar sozinho se o próprio portão se aplica. Aqui a regra é
// invertida e fail-closed — uma categoria só fica limpa quando o autor disse "nao" E o Jev respondeu
// "nao" com confiança suficiente; qualquer outra coisa (inclusive o Jev fora do ar) deixa a spec
// sensível. O Jev só acrescenta exigência, nunca dispensa o que o autor marcou (cofre #1375, #1404,
// #1405).
//
// Este arquivo traz as constantes, a normalização da resposta do Jev, a classificação (as quatro
// perguntas ao cliente), a regra de decisão, a união com rodadas anteriores e o texto da linha de
// registro. Não faz rede nem processo por conta própria; o único contato com o cliente do Jev é
// `carregarJev`.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CATEGORIAS = ["dado", "faturamento", "deploy", "migration"];
export const LIMIAR = 0.9; // confiança mínima de um "não" do Jev; cofre #1393
export const ORCAMENTO_MS = 20000; // teto de carregar o cliente + as quatro perguntas
export const PERGUNTAS = {
  dado: "A mudança descrita nesta spec altera dados já gravados, o formato em que são gravados, ou como dados existentes são lidos, tratados ou apagados?",
  faturamento: "A mudança descrita nesta spec altera uma regra de faturamento: o que é cobrado, calculado, validado ou enviado como produção faturável?",
  deploy: "A mudança descrita nesta spec altera como o sistema é implantado: infraestrutura, configuração de ambiente, pipeline de deploy ou o processo de instalação?",
  migration: "A mudança descrita nesta spec inclui uma migration: mudança de schema, de formato em disco, ou script que converte dados existentes?",
};
// Ordem fixa: é a ordem em que os motivos aparecem na saída e na linha.
export const MOTIVOS = ["autor", "jev-sim", "confianca-baixa", "jev-indisponivel"];
export const ROTULOS = {
  "autor": "autor",
  "jev-sim": "Jev sim",
  "confianca-baixa": "confiança baixa",
  "jev-indisponivel": "Jev indisponível",
};
export const OPT_IN = "gm-spec-jev.json"; // em <CLAUDE_HOME>; conteúdo {"enviarSpecAoJev": true}
export const REGISTRO = "sensibilidade.json"; // ao lado do spec.md

/** @typedef {{estado:"ok", resposta:"sim"|"nao", confianca:number} | {estado:"indisponivel", motivo:string}} RespostaJev */
/** @typedef {{perguntar:(pergunta:string, trecho:string)=>Promise<unknown>, cabe?:(trecho:string)=>boolean, origem:string}} Jev */

// Autorização própria para mandar texto de spec ao Jev nesta máquina (cofre #1404). Estrito: só o
// literal `true` liga; arquivo ausente, JSON quebrado ou qualquer outro valor deixa desligado — o que
// só torna o portão mais estrito.
export function optInLigado(claudeHome) {
  try {
    const conteudo = JSON.parse(readFileSync(join(claudeHome, OPT_IN), "utf8"));
    return conteudo?.enviarSpecAoJev === true;
  } catch {
    return false;
  }
}

// Pasta de configuração do Claude Code, como em hooks/brain-config.js.
export function claudeHomePadrao() {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
}

// A fronteira com o cliente do Jev do #42: a única função que o conhece. Nunca lança; devolve o
// cliente adaptado à forma `Jev` ou `null`.
export async function carregarJev() {
  // ligado ao contrato do #42 na task da fronteira
  return null;
}

// Aceita só a forma do contrato; qualquer outra coisa vira "indisponível", nunca um "nao" por acidente.
/** @returns {RespostaJev} */
export function normalizar(bruta) {
  if (bruta !== null && typeof bruta === "object") {
    if (bruta.estado === "ok" && (bruta.resposta === "sim" || bruta.resposta === "nao")) {
      const { confianca } = bruta;
      if (typeof confianca === "number" && Number.isFinite(confianca) && confianca >= 0 && confianca <= 1) {
        return { estado: "ok", resposta: bruta.resposta, confianca };
      }
    } else if (bruta.estado === "indisponivel" && typeof bruta.motivo === "string") {
      return { estado: "indisponivel", motivo: bruta.motivo };
    }
  }
  return { estado: "indisponivel", motivo: "resposta inválida" };
}

// O `process.stdout.write` original, guardado no carregamento do módulo: enquanto `classificar` roda,
// o stdout aponta para o stderr, e é por este que o CLI escreve a única linha de saída (task 3).
export const escreverNoStdoutOriginal = process.stdout.write.bind(process.stdout);

const MOTIVO_SEM_OPT_IN = "envio de spec ao Jev não autorizado nesta máquina";

const nomeDoErro = (erro) => (typeof erro?.name === "string" && erro.name !== "" ? erro.name : "desconhecido");

// Enquanto o cliente roda, nada dele pode chegar ao stdout: a saída do script é uma linha JSON e um
// `console.log` do cliente a corromperia. `console.*` e `process.stdout.write` passam a escrever no
// stderr; o stderr é resolvido a cada chamada, não aqui. Devolve a função que desfaz.
function desviarStdoutParaStderr() {
  const gravados = {
    write: process.stdout.write,
    log: console.log,
    info: console.info,
    debug: console.debug,
  };
  const paraStderr = (...argumentos) => process.stderr.write(argumentos.join(" ") + "\n");
  process.stdout.write = (pedaco, ...resto) => process.stderr.write(pedaco, ...resto);
  console.log = console.info = console.debug = paraStderr;
  return () => {
    process.stdout.write = gravados.write;
    console.log = gravados.log;
    console.info = gravados.info;
    console.debug = gravados.debug;
  };
}

// Faz as quatro perguntas ao Jev e devolve uma resposta por categoria; nunca lança. Um único
// temporizador de `orcamentoMs` cobre carregar o cliente e as quatro perguntas (o hook que o #42
// serve tem teto próprio e o /gm-spec não espera indefinidamente). O `texto` vai inteiro e sem
// alteração a cada pergunta: truncar calado esconderia justamente o trecho que torna a spec sensível.
/** @returns {Promise<{jev: Record<string, RespostaJev>, cliente: string|null}>} */
export async function classificar({ texto, carregar = carregarJev, optIn, orcamentoMs = ORCAMENTO_MS }) {
  const nasQuatro = (motivo) =>
    Object.fromEntries(CATEGORIAS.map((c) => [c, { estado: "indisponivel", motivo }]));

  // Sem autorização para mandar spec, o cliente nem é carregado.
  if (optIn === false) return { jev: nasQuatro(MOTIVO_SEM_OPT_IN), cliente: null };

  const ESGOTOU = Symbol("esgotou");
  let temporizador;
  const esgotou = new Promise((resolver) => {
    temporizador = setTimeout(() => resolver(ESGOTOU), orcamentoMs);
  });
  const desfazerDesvio = desviarStdoutParaStderr();
  try {
    let jev;
    try {
      jev = await Promise.race([Promise.resolve().then(() => carregar()), esgotou]);
    } catch (erro) {
      return { jev: nasQuatro(`erro ao carregar o cliente (${nomeDoErro(erro)})`), cliente: null };
    }
    if (jev === ESGOTOU) return { jev: nasQuatro("tempo esgotado ao carregar o cliente"), cliente: null };
    if (jev === null || jev === undefined) return { jev: nasQuatro("cliente do Jev não encontrado"), cliente: null };
    const cliente = typeof jev.origem === "string" ? jev.origem : null;

    try {
      if (typeof jev.cabe === "function" && jev.cabe(texto) === false) {
        return { jev: nasQuatro("spec maior que o limite do cliente"), cliente };
      }
    } catch (erro) {
      return { jev: nasQuatro(`erro do cliente (${nomeDoErro(erro)})`), cliente };
    }

    const respostas = await Promise.all(
      CATEGORIAS.map(async (categoria) => {
        try {
          // `.then` faz um throw síncrono de `perguntar` virar rejeição.
          const bruta = await Promise.race([
            Promise.resolve().then(() => jev.perguntar(PERGUNTAS[categoria], texto)),
            esgotou,
          ]);
          if (bruta === ESGOTOU) return [categoria, { estado: "indisponivel", motivo: "tempo esgotado" }];
          return [categoria, normalizar(bruta)];
        } catch (erro) {
          // Só o `name`: a `message` pode trazer chave de API ou trecho do corpus para um card público.
          return [categoria, { estado: "indisponivel", motivo: `erro do cliente (${nomeDoErro(erro)})` }];
        }
      }),
    );
    return { jev: Object.fromEntries(respostas), cliente };
  } finally {
    clearTimeout(temporizador);
    desfazerDesvio();
  }
}

// Ordena e deduplica motivos pela ordem fixa de MOTIVOS.
const emOrdem = (conjunto) => MOTIVOS.filter((m) => conjunto.has(m));

// A regra de CA1, fechada por inversão: a categoria é limpa só quando tudo confirma "nao"; o que não
// foi positivamente confirmado gera motivo. Por isso `!(confianca >= limiar)` e não `confianca < limiar`:
// NaN tem de cair em "confiança baixa" (e, antes disso, `normalizar` já o recusa).
export function decidir({ autor, jev, limiar = LIMIAR }) {
  const categorias = {};
  const todos = new Set();
  for (const categoria of CATEGORIAS) {
    const resposta = normalizar(jev?.[categoria]);
    const motivos = new Set();
    if (autor?.[categoria] !== "nao") motivos.add("autor");
    if (resposta.estado === "ok" && resposta.resposta === "sim") motivos.add("jev-sim");
    if (resposta.estado === "ok" && resposta.resposta === "nao" && !(resposta.confianca >= limiar)) {
      motivos.add("confianca-baixa");
    }
    if (resposta.estado !== "ok") motivos.add("jev-indisponivel");
    const ordenados = emOrdem(motivos);
    ordenados.forEach((m) => todos.add(m));
    categorias[categoria] = { autor: autor?.[categoria] ?? null, jev: resposta, motivos: ordenados };
  }
  const motivos = emOrdem(todos);
  return { categorias, motivos, sensivel: motivos.length > 0 };
}

// Lê os motivos de uma categoria tanto de `{cat: [..]}` quanto de `{cat: {motivos: [..]}}`.
function motivosDe(entrada, categoria) {
  const valor = entrada?.[categoria];
  const lista = Array.isArray(valor) ? valor : valor?.motivos;
  return Array.isArray(lista) ? lista : [];
}

// O veredito só cresce (CA9): motivos = união da rodada anterior com a atual. `novos` lista só os pares
// `autor` e `jev-sim` que aparecem agora e não estavam antes — é o que obriga o revisor a rodar de novo;
// `jev-indisponivel` e `confianca-baixa` oscilam com a rede e não valem isso.
export function unir(anterior, atual) {
  const uniao = {};
  const novos = [];
  for (const categoria of CATEGORIAS) {
    const antes = new Set(motivosDe(anterior, categoria));
    const agora = new Set(motivosDe(atual, categoria));
    uniao[categoria] = emOrdem(new Set([...antes, ...agora]));
    for (const motivo of ["autor", "jev-sim"]) {
      if (agora.has(motivo) && !antes.has(motivo)) novos.push(`${motivo}:${categoria}`);
    }
  }
  return { uniao, novos };
}

// A linha que a sessão copia verbatim: assim ela não compõe o texto do motivo (CA2).
export function montarLinha(motivosPorCategoria) {
  const partes = [];
  for (const motivo of MOTIVOS) {
    const afetadas = CATEGORIAS.filter((c) => motivosDe(motivosPorCategoria, c).includes(motivo));
    if (afetadas.length === 0) continue;
    const onde = afetadas.length === CATEGORIAS.length ? "as quatro" : afetadas.join(", ");
    partes.push(`${ROTULOS[motivo]} (${onde})`);
  }
  return partes.length === 0 ? "Spec sensível: não" : `Spec sensível: sim — ${partes.join("; ")}`;
}

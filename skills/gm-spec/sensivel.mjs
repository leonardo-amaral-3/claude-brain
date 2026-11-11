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
// perguntas ao cliente), a regra de decisão, a união com rodadas anteriores, o texto da linha de
// registro, o registro `sensibilidade.json` e o CLI. Não faz rede nem processo por conta própria; o
// único contato com o cliente do Jev é `carregarJev`.
//
// Uso:
//   node sensivel.mjs --spec <caminho do spec.md> --autor dado=nao,faturamento=nao,deploy=nao,migration=nao
// Saída: uma linha JSON no stdout, código 0 com qualquer veredito; código 2 é erro de uso ou de
// ambiente (a mensagem em pt-BR vai ao stderr); qualquer outro código é falha do script.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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

// A fronteira com o cliente do Jev do #42: a única função que o conhece. Devolve o cliente adaptado à
// forma `Jev`, `null` quando o arquivo não existe, e rejeita quando ele existe mas não carrega ou não
// tem a forma do contrato — `classificar` traduz a rejeição em "falhou ao carregar o cliente (<name>)".
// Separar os dois casos é o que impede a mensagem de dizer que o cliente não existe quando ele está lá
// (achado 7 do G4 da PR #53); os dois continuam fail-closed.
//
// O contrato (planning/42-filtro-jev/spec.md, § "Contrato do cliente do Jev (estável)"), ponto a ponto:
//  - R1: o cliente é `<CLAUDE_HOME>/hooks/jev.js`, um módulo CommonJS sem dependência, carregado com
//    `createRequire(import.meta.url)(caminho)`, como o contrato fixa para skills com script. O caminho
//    vem da instalação, nunca da posição deste script no repo.
//  - R2: usa `decidir` com uma pergunta `noul`, cuja `probabilidade` é P(sim). O limiar de decisão é
//    de quem chama: `sim` quando p >= 0,5 e `confianca = max(p, 1 - p)`.
//  - R3: flag (`BRAIN_JEV` com o uso `spec`) e chave (`TYPESAFE_API_KEY`) são do cliente, que responde
//    `indisponivel`; aqui não se lê nenhuma das duas.
//  - R4: `decidir` não trunca o estado, mas o recusa (`entrada_invalida`) acima de `MAX_ESTADO`
//    caracteres do `JSON.stringify`. `julgar` cortaria o texto em `MAX_TEXTO` (4000) sem recusar, e uma
//    spec é maior que isso: por isso não é ele. `cabe` mede o mesmo que o cliente mede.
//  - Orçamento: o cliente aceita `timeoutMs` por chamada e o recebe como `ORCAMENTO_MS`.
export async function carregarJev({ claudeHome = claudeHomePadrao() } = {}) {
  const caminho = join(claudeHome, "hooks", "jev.js");
  if (!existsSync(caminho)) return null;
  // Um `require` que lança (sintaxe, módulo lido como ESM, erro no topo) rejeita com o erro original;
  // só o `name` dele chega à saída.
  const cliente = createRequire(import.meta.url)(caminho);
  if (typeof cliente?.decidir !== "function" || !Number.isInteger(cliente.MAX_ESTADO)) {
    throw new ClienteForaDoContrato();
  }
  const maximoDoEstado = cliente.MAX_ESTADO;
  return {
    origem: caminho,
    cabe: (texto) => JSON.stringify(texto).length <= maximoDoEstado,
    perguntar: async (pergunta, texto) => {
      const respostas = await cliente.decidir(
        texto,
        { sensivel: { tipo: "noul", instrucao: pergunta } },
        { uso: "spec", timeoutMs: ORCAMENTO_MS },
      );
      const resposta = respostas?.sensivel;
      if (resposta?.estado === "indisponivel") {
        // `detalhe` é um status HTTP ou uma frase curta; o contrato garante que nunca traz chave nem corpo.
        const detalhe = typeof resposta.detalhe === "string" ? ` (${resposta.detalhe})` : "";
        return { estado: "indisponivel", motivo: `${resposta.motivo}${detalhe}` };
      }
      const p = resposta?.probabilidade;
      if (resposta?.estado === "ok" && resposta.tipo === "noul" && Number.isFinite(p) && p >= 0 && p <= 1) {
        return { estado: "ok", resposta: p >= 0.5 ? "sim" : "nao", confianca: Math.max(p, 1 - p) };
      }
      return { estado: "indisponivel", motivo: "resposta inválida" };
    },
  };
}

// O arquivo existe e carrega, mas não exporta `decidir` e `MAX_ESTADO` como o contrato manda.
class ClienteForaDoContrato extends Error {
  name = "ClienteForaDoContrato";
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
      return { jev: nasQuatro(`falhou ao carregar o cliente (${nomeDoErro(erro)})`), cliente: null };
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

// ---------------------------------------------------------------------------------------------
// Registro `sensibilidade.json` e CLI
// ---------------------------------------------------------------------------------------------

// Erro que o CLI traduz em código 2: a causa é do chamador ou do ambiente, não do veredito.
class ErroDeUso extends Error {}

const MENSAGEM_REGISTRO_ILEGIVEL =
  "sensibilidade.json ilegível — não apague nem edite à mão; mostre ao humano";

// Lê o registro ao lado do spec.md. Ausente → sem rodadas anteriores. Presente mas fora da forma →
// erro: apagar ou ignorar um registro quebrado devolveria à spec a chance de "voltar a não sensível".
function lerRegistro(caminho) {
  let conteudo;
  try {
    conteudo = readFileSync(caminho, "utf8");
  } catch (erro) {
    if (erro?.code === "ENOENT") return { rodadas: [], uniao: {} };
    throw new ErroDeUso(MENSAGEM_REGISTRO_ILEGIVEL);
  }
  let registro;
  try {
    registro = JSON.parse(conteudo);
  } catch {
    throw new ErroDeUso(MENSAGEM_REGISTRO_ILEGIVEL);
  }
  const uniao = registro?.uniao;
  if (!Array.isArray(registro?.rodadas) || uniao === null || typeof uniao !== "object" || Array.isArray(uniao)) {
    throw new ErroDeUso(MENSAGEM_REGISTRO_ILEGIVEL);
  }
  return registro;
}

// Grava por arquivo temporário + rename: uma queda no meio não deixa um registro pela metade, que
// viraria "ilegível" e travaria a spec.
function gravarRegistro(caminho, registro) {
  const temporario = `${caminho}.${process.pid}.tmp`;
  try {
    writeFileSync(temporario, JSON.stringify(registro, null, 2) + "\n", "utf8");
    renameSync(temporario, caminho);
  } catch (erro) {
    throw new ErroDeUso(`não consegui gravar ${REGISTRO}: ${erro.message}`);
  }
}

// `--spec <caminho> --autor cat=sim|nao,...`: exatamente um de cada, nada além disso.
export function lerArgumentos(argv) {
  let spec;
  let autorBruto;
  for (let i = 0; i < argv.length; i++) {
    const nome = argv[i];
    if (nome !== "--spec" && nome !== "--autor") {
      throw new ErroDeUso(`argumento inesperado: ${nome}. Uso: --spec <spec.md> --autor ${CATEGORIAS.map((c) => `${c}=<sim|nao>`).join(",")}`);
    }
    const valor = argv[++i];
    if (valor === undefined || valor.startsWith("--")) throw new ErroDeUso(`${nome} precisa de um valor`);
    if (nome === "--spec") {
      if (spec !== undefined) throw new ErroDeUso("--spec repetido");
      spec = valor;
    } else {
      if (autorBruto !== undefined) throw new ErroDeUso("--autor repetido");
      autorBruto = valor;
    }
  }
  if (spec === undefined) throw new ErroDeUso("falta --spec <caminho do spec.md>");
  if (autorBruto === undefined) throw new ErroDeUso("falta --autor com as quatro categorias");

  const autor = {};
  for (const par of autorBruto.split(",")) {
    const [categoria, valor, ...sobra] = par.split("=");
    if (!CATEGORIAS.includes(categoria)) throw new ErroDeUso(`categoria desconhecida em --autor: "${categoria}"`);
    if (categoria in autor) throw new ErroDeUso(`categoria repetida em --autor: ${categoria}`);
    if (sobra.length > 0 || (valor !== "sim" && valor !== "nao")) {
      throw new ErroDeUso(`valor de ${categoria} em --autor deve ser sim ou nao`);
    }
    autor[categoria] = valor;
  }
  const faltando = CATEGORIAS.filter((c) => !(c in autor));
  if (faltando.length > 0) throw new ErroDeUso(`--autor sem: ${faltando.join(", ")}`);
  return { spec, autor };
}

// O caminho feliz, na ordem da spec: lê e resume o spec.md, classifica, decide, lê o registro, une,
// grava o registro e só então devolve a saída (que o chamador imprime).
async function executar(argv) {
  const { spec, autor } = lerArgumentos(argv);
  const caminhoSpec = resolve(spec);
  if (basename(caminhoSpec) !== "spec.md") throw new ErroDeUso("--spec deve apontar para um arquivo chamado spec.md");
  let bytesDoSpec;
  try {
    bytesDoSpec = readFileSync(caminhoSpec);
  } catch (erro) {
    throw new ErroDeUso(`não consegui ler ${caminhoSpec}: ${erro.message}`);
  }
  const texto = bytesDoSpec.toString("utf8");
  if (texto.trim() === "") throw new ErroDeUso(`${caminhoSpec} está vazio`);
  const sha256 = createHash("sha256").update(bytesDoSpec).digest("hex");

  const optIn = optInLigado(claudeHomePadrao());
  const { jev, cliente } = await classificar({ texto, optIn });
  const rodada = decidir({ autor, jev });

  const caminhoRegistro = join(dirname(caminhoSpec), REGISTRO);
  const registro = lerRegistro(caminhoRegistro);
  const { uniao, novos } = unir(registro.uniao, rodada.categorias);
  registro.rodadas.push({
    data: new Date().toISOString(),
    sha256,
    autor,
    cliente,
    // O que fica no registro é só o veredito da rodada e os motivos fixos do Jev, nunca texto da spec.
    categorias: Object.fromEntries(
      CATEGORIAS.map((c) => [c, { motivos: rodada.categorias[c].motivos, jev: rodada.categorias[c].jev }]),
    ),
  });
  registro.uniao = uniao;
  gravarRegistro(caminhoRegistro, registro);

  // `sensivel`, `motivos` e `categorias[c].motivos` são os da união; o da rodada ficou no registro.
  const motivos = MOTIVOS.filter((m) => CATEGORIAS.some((c) => uniao[c].includes(m)));
  return {
    sensivel: motivos.length > 0,
    motivos,
    novos,
    linha: montarLinha(uniao),
    spec: caminhoSpec,
    bytes: bytesDoSpec.length,
    sha256,
    cliente,
    optIn,
    limiar: LIMIAR,
    categorias: Object.fromEntries(
      CATEGORIAS.map((c) => [c, { autor: autor[c], jev: rodada.categorias[c].jev, motivos: uniao[c] }]),
    ),
  };
}

async function main() {
  let saida;
  try {
    saida = await executar(process.argv.slice(2));
  } catch (erro) {
    if (!(erro instanceof ErroDeUso)) throw erro; // falha do script: exceção não tratada, código 1
    process.stderr.write(`sensivel.mjs: ${erro.message}\n`, () => process.exit(2));
    return;
  }
  // Pelo callback de escrita, para o pipe esvaziar antes de sair e para um handle aberto do cliente
  // não segurar o processo.
  escreverNoStdoutOriginal(JSON.stringify(saida) + "\n", () => process.exit(0));
}

// Só roda como script, não ao ser importado pelo teste. Compara caminhos reais para que um link
// simbólico para este arquivo também conte como ponto de entrada.
function ehPontoDeEntrada() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (ehPontoDeEntrada()) await main();

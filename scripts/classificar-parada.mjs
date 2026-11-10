#!/usr/bin/env node
// Card #44: classifica o motivo de uma `PARADA:` numa lista fixa de oito categorias, com probabilidade,
// para a orquestradora decidir se segue sozinha ou escala para o humano.
//
//   printf 'PARADA: <motivo>\n' | node scripts/classificar-parada.mjs
//
// Entrada: o texto de saída de uma sessão despachada, pelo stdin. Vale a última linha não vazia, que
// precisa ser `PARADA: <motivo>`. Saída: uma linha JSON com `estado`, `categoria`, `probabilidade`,
// `escala` e `porque`, nesta ordem.
//
// Códigos de saída: 0 uma das três saídas válidas · 1 falha interna · 2 uso errado.
//
// Por que a lista fica neste script, com guarda contra a tabela, e não é lida da tabela a cada
// chamada: a orquestradora casa a política dela pelo id da categoria, e a 1ª célula da tabela do
// `## Modo despachado` de `skills/_comum/convencoes.md` não é id estável — é texto, e já foi
// reescrito. Lida na hora, uma linha renomeada viraria categoria sem id. Com a lista aqui, a guarda
// (`divergenciaDaLista`) transforma a divergência em escalada, e o teste pega a divergência antes.
//
// Por que a entrada vem do stdin, e não de argumento: o motivo de uma PARADA quase sempre tem crases,
// e `node x.mjs "$linha"` no bash executaria cada trecho entre crases.
//
// Com o cliente falso do #42 no ambiente (`BRAIN_JEV_FALSO` definida, mesmo vazia), toda saída
// `classificada` escala com `porque: "falso"` (emenda 1 da spec).
//
// Por que a falha fecha (fail-closed): com o Jev ligado, quem lê a saída espera que o classificador
// funcione. Erro, tempo esgotado, resposta inválida e lista divergente escalam, cada um com o seu
// `porque`; nenhum deles vira `desligado`, porque uma falha silenciosa devolveria a parada à leitura
// de hoje justamente quando algo está quebrado.
//
// O cliente do Jev NÃO nasce aqui: é o `hooks/jev.js` do #42, importado por caminho relativo. Este
// script só o adapta (`daFormaDo42`) à forma que o classificador espera, sem HTTP, chave nem flag.
// O uso `parada` é o que o `BRAIN_JEV` precisa listar para ligar este consumidor.

import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// CommonJS importado de ESM: o `default` é o `module.exports` do cliente.
import clienteDo42 from "../hooks/jev.js";

// Abaixo disto a categoria escala, mesmo não sendo reservada. Com oito opções o acaso dá 0.125; o
// número foi escolhido pelo custo do erro (escalar demais custa uma leitura que já se faz hoje) e
// será recalibrado com as PARADA reais quando o Leonardo autorizar o envio (CA4 da spec).
export const LIMIAR = 0.8;

// Teto de tempo próprio da chamada ao Jev: garante "estouro de tempo → sem classificação" mesmo que
// o orçamento do cliente do #42 seja outro.
export const TEMPO_MS = 5000;

export const PERGUNTA =
  "Uma sessão automática da esteira parou e escreveu o motivo abaixo. Qual categoria descreve esse motivo?";

// Cada item: `linha` é a 1ª célula EXATA da tabela (com crases), ou null nas duas extras; `texto` é o
// que vai ao Jev; `sempre` é "reservada" (só o humano decide), "outro" (a esteira não previu) ou null.
const semCrases = (linha) => linha.replaceAll("`", "");
const daTabela = (id, linha, sempre = null) => ({ id, linha, texto: semCrases(linha), sempre });

export const CATEGORIAS = [
  daTabela("segundo-revisor", "Segundo revisor de spec sensível"),
  daTabela("alvo-ambiguo", "Alvo ambíguo: repo, card, pasta, PR"),
  daTabela(
    "escolha-de-produto",
    "Escolha de produto que card, spec, argumento e decisões registradas não respondem",
    "reservada",
  ),
  daTabela("desvio-de-spec", "Desvio da spec, decisão que caiu, emenda"),
  daTabela("teste-vermelho", "Teste vermelho, ambiente quebrado, `CLAUDE.md` que não declara o que a skill exige"),
  daTabela("producao", "Merge, `main`, tag, release, deploy, produção, instalação viva, apagar", "reservada"),
  {
    id: "gate-aberto",
    linha: null,
    texto:
      "Gate ou etapa que espera a resposta de um humano, deixada aberta porque a sessão não recebeu a frente para decidir",
    sempre: null,
  },
  { id: "outro", linha: null, texto: "Nenhuma das outras categorias", sempre: "outro" },
];

// Jev desligado (sem a flag ou sem a chave): a saída diz isso e quem lê volta à leitura de hoje.
export const DESLIGADO = Object.freeze({
  estado: "desligado",
  categoria: null,
  probabilidade: null,
  escala: null,
  porque: null,
});

// Todo texto lido passa de CRLF para LF antes de qualquer comparação, como em prova-modelo.mjs: um
// arquivo salvo com CRLF no Windows não pode virar divergência.
const comoLF = (texto) => texto.replaceAll("\r\n", "\n");

// Pega a última linha com algo além de espaço (o `tail -1` do despachante não pula linha em branco
// no fim; aqui pula), apara os dois lados e exige `PARADA:` no começo. → { motivo } | { erro }
// Espaço à esquerda passa (achado 8 do G4); `**PARADA:**` em negrito não: a convenção fixa a linha
// simples, e o código 2 já devolve quem lê à leitura de sempre.
export function lerEntrada(texto) {
  const linhas = comoLF(texto).split("\n");
  const ultima = linhas.findLast((linha) => linha.trim() !== "");
  if (ultima === undefined) return { erro: "entrada vazia" };

  const casou = /^PARADA:\s*(.*)$/.exec(ultima.trim());
  if (!casou) return { erro: "a última linha não é PARADA:" };

  const motivo = casou[1].trim();
  if (motivo === "") return { erro: "PARADA sem motivo" };
  return { motivo };
}

// As 1ªs células das linhas da tabela do `## Modo despachado` cuja 3ª célula começa com `**para**`.
// Sem o cabeçalho, devolve [] — e a guarda então acusa divergência, em vez de passar calada.
export function linhasParaDaTabela(markdown) {
  const linhas = comoLF(markdown).split("\n");
  const inicio = linhas.indexOf("## Modo despachado");
  if (inicio === -1) return [];

  const regiao = [];
  for (const linha of linhas.slice(inicio + 1)) {
    if (linha.startsWith("## ")) break;
    regiao.push(linha);
  }

  const celulasPara = [];
  for (const linha of regiao) {
    if (!linha.startsWith("|")) continue;
    const celulas = linha.split("|").slice(1, -1).map((celula) => celula.trim());
    if (celulas[2]?.startsWith("**para**")) celulasPara.push(celulas[0]);
  }
  return celulasPara;
}

// Compara, como conjunto, as linhas para da tabela com as `linha` não nulas de CATEGORIAS.
// → null se batem; senão uma linha de texto que nomeia o que sobra de cada lado.
export function divergenciaDaLista(markdown) {
  const daTabelaAgora = linhasParaDaTabela(markdown);
  const doScript = CATEGORIAS.map((categoria) => categoria.linha).filter((linha) => linha !== null);

  const soNaTabela = daTabelaAgora.filter((linha) => !doScript.includes(linha));
  const soNoScript = doScript.filter((linha) => !daTabelaAgora.includes(linha));
  const mesmoTamanho = daTabelaAgora.length === doScript.length;
  if (mesmoTamanho && soNaTabela.length === 0 && soNoScript.length === 0) return null;

  return (
    `lista divergente: na tabela e não no script: ${JSON.stringify(soNaTabela)}; ` +
    `no script e não na tabela: ${JSON.stringify(soNoScript)}`
  );
}

// Marcador que o teto de tempo resolve; um símbolo, para nunca se confundir com a resposta do Jev.
const TEMPO = Symbol("tempo");

// Monta o resultado sempre com as chaves na mesma ordem, para o JSON sair sempre igual.
const resultadoDe = (estado, categoria, probabilidade, escala, porque) => ({
  estado,
  categoria,
  probabilidade,
  escala,
  porque,
});
const semClassificacao = (porque, aviso = "") => ({
  resultado: resultadoDe("sem-classificacao", null, null, true, porque),
  aviso,
});

// O uso pelo qual o #42 liga e mede este consumidor (um dos seis valores fechados do contrato).
const USO_DO_JEV = "parada";

// Adapta o cliente do #42 (`ligado(uso, env)` e `decidir(estado, perguntas, opcoes)`) à forma que
// `classificar` espera (`ligado()` e `escolher({ pergunta, texto, opcoes, signal })`). É só "mesma
// informação, outra forma" — nenhuma capacidade falta, então não há emenda:
//   - `ligado` fixa o uso `parada` e o ambiente do processo; não faz rede.
//   - `falso` diz se o cliente de teste do #42 responde no lugar do real: `BRAIN_JEV_FALSO` definida
//     no mesmo ambiente, mesmo vazia (a regra do próprio #42). Ver o passo 5 de `classificar`.
//   - `escolher` vira UMA pergunta `escolha` do `decidir`, com o motivo como estado. O nome de cada
//     opção é o próprio texto (é com ele que `classificar` reconhece a resposta), e a descrição
//     repete o texto porque o contrato pede uma descrição por opção.
//   - Vale a `escolha` do Jev, com a `confianca` dele (emenda 2 da spec, achado 3 do G4). O maior
//     valor de `probabilidades` (no empate, a primeira na ordem de `opcoes`, a de CATEGORIAS) só
//     decide quando a resposta não traz uma `escolha` que seja uma das opções. Ao contrário, um
//     empate trocaria a reservada que o Jev escolheu por uma não reservada que vem antes na ordem.
//   - `indisponivel` (rede, HTTP, chave, tempo) vira rejeição, que `classificar` escala como "erro":
//     com a flag ligada, indisponível não é "desligado".
//   - O #42 não recebe `signal`; o teto de tempo é o do próprio `classificar`, e o `timeoutMs` do
//     cliente fica no mesmo valor (o `tempoMs` que `classificar` recebeu) para nunca sobrar chamada
//     pendurada depois dele.
export function daFormaDo42(cliente, { env = process.env, timeoutMs = TEMPO_MS } = {}) {
  return {
    ligado: () => cliente.ligado(USO_DO_JEV, env),
    falso: () => env.BRAIN_JEV_FALSO !== undefined,
    escolher: async ({ pergunta, texto, opcoes }) => {
      const descricoes = Object.fromEntries(opcoes.map((opcao) => [opcao, opcao]));
      const perguntas = { escolha: { tipo: "escolha", instrucao: pergunta, opcoes: descricoes } };
      const respostas = await cliente.decidir(texto, perguntas, { uso: USO_DO_JEV, timeoutMs, env });
      const resposta = respostas?.escolha;
      if (resposta?.estado !== "ok" || resposta.tipo !== "escolha") {
        throw new Error(`jev indisponível: ${resposta?.motivo ?? "sem resposta"}`);
      }

      const daEscolha = { opcao: resposta.escolha, probabilidade: resposta.confianca };
      if (opcoes.includes(resposta.escolha)) return daEscolha;

      const porOpcao = resposta.probabilidades;
      if (porOpcao === null || typeof porOpcao !== "object") return daEscolha;
      let melhor = null;
      for (const opcao of opcoes) {
        if (typeof porOpcao[opcao] === "number" && (melhor === null || porOpcao[opcao] > melhor.probabilidade)) {
          melhor = { opcao, probabilidade: porOpcao[opcao] };
        }
      }
      // Sem nada aproveitável, a escolha inválida segue e `classificar` a escala como resposta-invalida.
      return melhor ?? daEscolha;
    },
  };
}

const lerConvencoesDoRepo = () =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "_comum", "convencoes.md"), "utf8");

// → { resultado, aviso }. `aviso` só é não vazio quando a lista diverge da tabela: vai para o stderr.
export async function classificar(motivo, deps = {}) {
  const { lerConvencoes = lerConvencoesDoRepo, tempoMs = TEMPO_MS, limiar = LIMIAR } = deps;
  // Criado aqui, e não no topo do módulo, para quem só importa o script não carregar nada do ambiente.
  // O prazo do cliente do #42 é o mesmo `tempoMs` do teto daqui (achado 9 do G4): com prazos
  // diferentes, o cliente desistiria antes e a saída diria "erro" onde a causa foi "tempo". `deps.jev`
  // troca o módulo do #42, só para o teste provar isso sem rede.
  const cliente = deps.cliente ?? daFormaDo42(deps.jev ?? clienteDo42, { timeoutMs: tempoMs });

  // 1. Ligado? Sem rede. Falha aqui escala (fail-closed): com a flag ligada, não é "desligado".
  let ligado;
  try {
    ligado = await cliente.ligado();
  } catch {
    return semClassificacao("erro");
  }
  if (!ligado) return { resultado: DESLIGADO, aviso: "" };

  // 2. A lista do script ainda bate com a tabela? Se não, o motivo nem sai da máquina.
  let divergencia;
  try {
    divergencia = divergenciaDaLista(lerConvencoes());
  } catch (erro) {
    divergencia = `lista divergente: não li skills/_comum/convencoes.md: ${erro.message}`;
  }
  if (divergencia !== null) return semClassificacao("lista-divergente", divergencia);

  // 3. Uma pergunta ao Jev, com teto de tempo e sem nova tentativa (repetir dobraria o envio do motivo).
  const opcoes = CATEGORIAS.map((categoria) => categoria.texto);
  const controlador = new AbortController();
  let temporizador;
  let resposta;
  try {
    // O `then` transforma até exceção síncrona do cliente em rejeição.
    const chamada = Promise.resolve().then(() =>
      cliente.escolher({ pergunta: PERGUNTA, texto: motivo, opcoes, signal: controlador.signal }),
    );
    // Se o tempo vencer, a chamada rejeita depois do abort; sem isto seria rejeição não tratada.
    chamada.catch(() => {});
    const estouro = new Promise((resolver) => {
      temporizador = setTimeout(() => resolver(TEMPO), tempoMs);
    });
    resposta = await Promise.race([chamada, estouro]);
  } catch {
    return semClassificacao("erro");
  } finally {
    clearTimeout(temporizador);
    controlador.abort();
  }
  if (resposta === TEMPO) return semClassificacao("tempo");

  // 4. Resposta fora do contrato.
  const probabilidadeValida =
    typeof resposta?.probabilidade === "number" &&
    Number.isFinite(resposta.probabilidade) &&
    resposta.probabilidade >= 0 &&
    resposta.probabilidade <= 1;
  if (resposta === null || typeof resposta !== "object" || !opcoes.includes(resposta.opcao) || !probabilidadeValida) {
    return semClassificacao("resposta-invalida");
  }

  // 5. Escalada: a reservada e o `outro` escalam com qualquer confiança; o resto, abaixo do limiar.
  const categoria = CATEGORIAS.find((candidata) => candidata.texto === resposta.opcao);
  let escala = false;
  let porque = null;
  if (categoria.sempre) {
    escala = true;
    porque = categoria.sempre;
  } else if (resposta.probabilidade < limiar) {
    escala = true;
    porque = "abaixo-do-limiar";
  }
  // Emenda 1 da spec (achado 1 do G4): resposta do cliente falso do #42 nunca sai como classificação
  // real. Um BRAIN_JEV_FALSO esquecido no ambiente da orquestradora faria uma parada de merge sair
  // contornável. Categoria e probabilidade seguem como vieram, para o smoke offline seguir legível.
  if (typeof cliente.falso === "function" && cliente.falso() === true) {
    escala = true;
    porque = "falso";
  }
  return {
    resultado: resultadoDe("classificada", categoria.id, resposta.probabilidade, escala, porque),
    aviso: "",
  };
}

// → { codigo, saida, erro }. Entrada inválida é uso errado (2) e deixa o stdout vazio.
export async function executar(textoEntrada, deps = {}) {
  const entrada = lerEntrada(textoEntrada);
  if (entrada.erro !== undefined) return { codigo: 2, saida: "", erro: entrada.erro };

  const { resultado, aviso } = await classificar(entrada.motivo, deps);
  return { codigo: 0, saida: JSON.stringify(resultado), erro: aviso };
}

const USO_DA_CLI = "uso: printf 'PARADA: <motivo>\\n' | node scripts/classificar-parada.mjs (sem argumentos; o motivo vem do stdin)";

// Escreve e só então sai: `process.exit` direto, com o stdout num pipe, pode cortar a linha.
function sairDepoisDeEscrever(codigo, saida, erro) {
  const escrever = (fluxo, texto, proximo) =>
    texto === "" ? proximo() : fluxo.write(`${texto}\n`, proximo);
  escrever(process.stdout, saida, () => escrever(process.stderr, erro, () => process.exit(codigo)));
}

// Lê o stdin, classifica e sai. O `process.exit` é de propósito (ver Technical Decisions da spec):
// um cliente que ignora o `signal` e segura o event loop não pode pendurar o processo, e o teto de
// tempo do `classificar` já decidiu o resultado.
export async function rodarCli(argv, deps = {}) {
  // Falha inesperada é 1 com stdout vazio, nunca um 0 com lixo.
  try {
    if (argv.length > 0) return sairDepoisDeEscrever(2, "", USO_DA_CLI);
    if (process.stdin.isTTY) return sairDepoisDeEscrever(2, "", USO_DA_CLI);

    const pedacos = [];
    for await (const pedaco of process.stdin) pedacos.push(pedaco);
    const texto = Buffer.concat(pedacos).toString("utf8");

    const { codigo, saida, erro } = await executar(texto, deps);
    return sairDepoisDeEscrever(codigo, saida, erro);
  } catch (erro) {
    return sairDepoisDeEscrever(1, "", `erro interno: ${erro?.message ?? erro}`);
  }
}

// Só roda como comando; importado (pelo teste) não lê o stdin. `realpathSync` dos dois lados, porque
// o `argv[1]` pode vir por um link simbólico; no Windows a caixa da letra do disco também varia.
const normalizarCaminho = (caminho) => (process.platform === "win32" ? caminho.toLowerCase() : caminho);
if (
  process.argv[1] !== undefined &&
  normalizarCaminho(realpathSync(process.argv[1])) === normalizarCaminho(realpathSync(fileURLToPath(import.meta.url)))
) {
  await rodarCli(process.argv.slice(2));
}

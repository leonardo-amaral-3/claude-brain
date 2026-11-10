#!/usr/bin/env node
// Testa scripts/classificar-parada.mjs (card #44). Sem rede e sem escrever no repo.
// Uso: node scripts/classificar-parada-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
//
// C1–C8 rodam no próprio processo, sempre com o Jev falso injetado em `deps.cliente`. Os processos
// de verdade (C9) e a CLI entram com a task seguinte.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORIAS,
  DESLIGADO,
  classificar,
  divergenciaDaLista,
  executar,
  lerEntrada,
  linhasParaDaTabela,
} from "./classificar-parada.mjs";
import { criarJevFalso } from "./jev-falso.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const convencoes = readFileSync(join(aqui, "..", "skills", "_comum", "convencoes.md"), "utf8");

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}

const mesmaLista = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const linhasDoScript = CATEGORIAS.map((c) => c.linha).filter((linha) => linha !== null);

const CHAVES = ["estado", "categoria", "probabilidade", "escala", "porque"];

// Roda `classificar` com um Jev falso novo e devolve também o falso, para ler `chamadas` e o signal.
async function rodar(motivo, opcoesDoFalso = {}, depsExtras = {}) {
  const cliente = criarJevFalso(opcoesDoFalso);
  const saida = await classificar(motivo, { cliente, ...depsExtras });
  return { ...saida, cliente };
}

console.log("C1 — as oito categorias saem, cada uma com a sua palavra-chave");
const motivosPorId = {
  "segundo-revisor": "precisa de segundo revisor para a spec",
  "alvo-ambiguo": "o alvo é ambíguo: dois repos com esse nome",
  "escolha-de-produto": "escolha de produto que o card não responde",
  "desvio-de-spec": "houve desvio da spec na task 3",
  "teste-vermelho": "o teste ficou vermelho",
  producao: "o merge na dev é do Leonardo",
  "gate-aberto": "o gate G2 ficou aberto",
  outro: "a lua entrou em Peixes",
};
const vistas = new Set();
for (const [id, motivo] of Object.entries(motivosPorId)) {
  const { resultado, aviso } = await rodar(motivo);
  vistas.add(resultado.categoria);
  afirmar(resultado.categoria === id && resultado.estado === "classificada", `"${id}" sai classificada`);
  afirmar(aviso === "", `"${id}" sem aviso`);
}
afirmar(vistas.size === 8 && CATEGORIAS.every((c) => vistas.has(c.id)), "as oito categorias saíram ao menos uma vez");

console.log("C2 — reservada e outro escalam com qualquer confiança");
for (const [id, porque] of [["producao", "reservada"], ["escolha-de-produto", "reservada"], ["outro", "outro"]]) {
  for (const probabilidade of [0.3, 0.99]) {
    const { resultado } = await rodar(motivosPorId[id], { probabilidade });
    afirmar(
      resultado.categoria === id && resultado.escala === true && resultado.porque === porque,
      `${id} com ${probabilidade} → escala, porque "${porque}"`,
    );
  }
}

console.log("C3 — o limiar: 0.79 escala, 0.8 não");
const abaixo = (await rodar(motivosPorId["teste-vermelho"], { probabilidade: 0.79 })).resultado;
afirmar(abaixo.escala === true && abaixo.porque === "abaixo-do-limiar", "0.79 → escala, abaixo-do-limiar");
const noLimiar = (await rodar(motivosPorId["teste-vermelho"], { probabilidade: 0.8 })).resultado;
afirmar(noLimiar.escala === false && noLimiar.porque === null, "0.8 → não escala, porque null");
afirmar(noLimiar.probabilidade === 0.8, "a probabilidade sai como o Jev devolveu");

console.log("C4 — Jev com defeito: sem classificação, uma chamada só");
for (const [defeito, porque] of [["erro", "erro"], ["lanca-sincrono", "erro"]]) {
  const { resultado, cliente } = await rodar("qualquer", { defeito });
  afirmar(
    resultado.estado === "sem-classificacao" && resultado.escala === true && resultado.porque === porque,
    `${defeito} → sem-classificacao, escala, "${porque}"`,
  );
  afirmar(resultado.categoria === null && resultado.probabilidade === null, `${defeito}: categoria e probabilidade null`);
  afirmar(cliente.chamadas === 1, `${defeito}: chamadas === 1 (sem nova tentativa)`);
}
{
  // O falso "tempo" guarda o signal que recebeu, via um envoltório, para provar que foi abortado.
  const falso = criarJevFalso({ defeito: "tempo" });
  let sinalRecebido = null;
  const cliente = {
    ligado: falso.ligado,
    escolher: (pedido) => {
      sinalRecebido = pedido.signal;
      return falso.escolher(pedido);
    },
  };
  const { resultado } = await classificar("qualquer", { cliente, tempoMs: 50 });
  afirmar(
    resultado.estado === "sem-classificacao" && resultado.escala === true && resultado.porque === "tempo",
    "tempo → sem-classificacao, escala, \"tempo\"",
  );
  afirmar(falso.chamadas === 1, "tempo: chamadas === 1");
  afirmar(sinalRecebido?.aborted === true, "tempo: o signal recebido pelo falso está abortado");
}
{
  const { resultado, cliente } = await rodar("qualquer", { defeito: "ligado-lanca" });
  afirmar(
    resultado.estado === "sem-classificacao" && resultado.escala === true && resultado.porque === "erro",
    "ligado-lanca → sem-classificacao, escala, \"erro\"",
  );
  afirmar(cliente.chamadas === 0, "ligado-lanca: escolher não é chamado");
}

console.log("C5 — desligado: nenhuma chamada e a tabela nem é lida");
{
  let leituras = 0;
  const lerConvencoes = () => {
    leituras++;
    return convencoes;
  };
  const { resultado, aviso, cliente } = await rodar("PARADA qualquer", { defeito: "desligado" }, { lerConvencoes });
  afirmar(resultado === DESLIGADO, "o resultado é DESLIGADO");
  afirmar(JSON.stringify(resultado) === JSON.stringify({ estado: "desligado", categoria: null, probabilidade: null, escala: null, porque: null }), "desligado: forma exata");
  afirmar(aviso === "", "desligado: sem aviso");
  afirmar(cliente.chamadas === 0, "escolher não foi chamado");
  afirmar(leituras === 0, "lerConvencoes não foi chamada");
}

console.log("C6 — resposta inválida escala");
for (const defeito of ["opcao-fora", "probabilidade-fora", "nao-objeto"]) {
  const { resultado } = await rodar("qualquer", { defeito });
  afirmar(
    resultado.estado === "sem-classificacao" && resultado.escala === true && resultado.porque === "resposta-invalida",
    `${defeito} → resposta-invalida, escala`,
  );
}

console.log("C7 — a lista contra a tabela real");
afirmar(CATEGORIAS.length === 8, "são oito categorias");
afirmar(new Set(CATEGORIAS.map((c) => c.id)).size === 8, "os ids são únicos");
afirmar(
  mesmaLista(linhasParaDaTabela(convencoes), linhasDoScript),
  "linhasParaDaTabela no arquivo real devolve exatamente as seis `linha`, na ordem",
);
afirmar(linhasParaDaTabela(convencoes).length === 6, "são seis linhas para");
afirmar(divergenciaDaLista(convencoes) === null, "divergenciaDaLista no arquivo real é null");
afirmar(linhasParaDaTabela("## Outra seção\n| a | b | **para** |\n").length === 0, "sem o cabeçalho, devolve []");
afirmar(
  mesmaLista(linhasParaDaTabela(convencoes.replaceAll("\n", "\r\n")), linhasDoScript),
  "o arquivo com CRLF dá as mesmas seis linhas",
);

// (a) a 1ª célula de uma linha renomeada: some da tabela a antiga e aparece a nova.
const celulaVelha = "Alvo ambíguo: repo, card, pasta, PR";
const celulaNova = "Alvo ambíguo: repositório, card, pasta, PR";
const renomeada = divergenciaDaLista(convencoes.replace(`| ${celulaVelha} |`, `| ${celulaNova} |`));
afirmar(typeof renomeada === "string" && renomeada.startsWith("lista divergente:"), "(a) célula renomeada diverge");
afirmar(renomeada?.includes(celulaNova) && renomeada?.includes(celulaVelha), "(a) a mensagem cita a célula nova e a velha");

// (b) uma linha **para** a mais, logo depois da última linha da tabela.
const linhaExtra = "| Linha nova que o script não conhece | qualquer | **para** |";
const ultimaLinhaDaTabela = "| Devolver comando `/gm-*` para alguém digitar | qualquer | **não faz** — vai na linha `PROXIMO:` |";
const comExtra = convencoes.replace(ultimaLinhaDaTabela, `${ultimaLinhaDaTabela}\n${linhaExtra}`);
afirmar(comExtra !== convencoes, "(b) a linha extra entrou no texto de teste");
const extra = divergenciaDaLista(comExtra);
afirmar(typeof extra === "string" && extra.startsWith("lista divergente:"), "(b) linha **para** a mais diverge");
afirmar(extra?.includes("Linha nova que o script não conhece"), "(b) a mensagem cita a célula a mais");

// Uma linha **para** repetida não some no conjunto: o tamanho também conta.
const repetida = convencoes.replace(
  ultimaLinhaDaTabela,
  `${ultimaLinhaDaTabela}\n| ${celulaVelha} | qualquer | **para** |`,
);
afirmar(divergenciaDaLista(repetida) !== null, "(b) linha **para** repetida também diverge");

console.log("C7 — a guarda dentro de `classificar` (a, b, c)");
const motivoQualquer = "o merge na dev é do Leonardo";
const divergentes = {
  "(a) célula renomeada": () => convencoes.replace(`| ${celulaVelha} |`, `| ${celulaNova} |`),
  "(b) linha para a mais": () => comExtra,
  "(c) lerConvencoes lança": () => {
    throw new Error("sem arquivo");
  },
};
for (const [nome, lerConvencoes] of Object.entries(divergentes)) {
  const { resultado, aviso, cliente } = await rodar(motivoQualquer, {}, { lerConvencoes });
  afirmar(
    resultado.estado === "sem-classificacao" && resultado.escala === true && resultado.porque === "lista-divergente",
    `${nome} → lista-divergente, escala`,
  );
  afirmar(cliente.chamadas === 0, `${nome}: o Jev não foi chamado`);
  afirmar(aviso.startsWith("lista divergente:"), `${nome}: aviso começa com "lista divergente:"`);
  if (nome.startsWith("(a)")) afirmar(aviso.includes(celulaNova) && aviso.includes(celulaVelha), "(a) o aviso cita a célula nova e a velha");
}

console.log("C8 — executar e lerEntrada");
{
  const entrada = "linha um\r\nlinha dois\r\nPARADA: o merge na dev é do Leonardo.\r\n\r\n  \r\n";
  const feito = await executar(entrada, { cliente: criarJevFalso() });
  afirmar(feito.codigo === 0 && feito.erro === "", "texto com CRLF e brancos no fim → código 0, sem erro");
  afirmar(mesmaLista(Object.keys(JSON.parse(feito.saida)), CHAVES), "a saída tem as chaves na ordem certa");
  afirmar(JSON.parse(feito.saida).categoria === "producao", "a saída classifica o motivo da última linha");
  afirmar(!feito.saida.includes("\n"), "a saída é uma linha só");

  for (const [rotulo, texto] of [["PROXIMO:", "PROXIMO: /gm-plan-tasks x"], ["vazia", ""], ["sem motivo", "PARADA:"]]) {
    const ruim = await executar(texto, { cliente: criarJevFalso() });
    afirmar(ruim.codigo === 2 && ruim.saida === "" && ruim.erro !== "", `entrada ${rotulo} → código 2, saida vazia`);
  }

  const divergida = await executar("PARADA: x", {
    cliente: criarJevFalso(),
    lerConvencoes: divergentes["(a) célula renomeada"],
  });
  afirmar(divergida.codigo === 0, "lista divergente por executar → código 0");
  afirmar(JSON.parse(divergida.saida).porque === "lista-divergente", "a saída diz lista-divergente");
  afirmar(divergida.erro.startsWith("lista divergente:") && divergida.erro === (await rodar("x", {}, { lerConvencoes: divergentes["(a) célula renomeada"] })).aviso, "o erro é igual ao aviso do C7(a)");

  const desligada = await executar("PARADA: x", { cliente: criarJevFalso({ defeito: "desligado" }) });
  afirmar(desligada.codigo === 0 && JSON.parse(desligada.saida).estado === "desligado", "desligado → código 0");
}

console.log("C8 — lerEntrada");
const classificada = lerEntrada("linha um\r\nlinha dois\r\nPARADA: o merge na dev é do Leonardo.\r\n\r\n  \r\n");
afirmar(classificada.motivo === "o merge na dev é do Leonardo.", "várias linhas com CRLF e brancos no fim: pega o motivo");
afirmar(lerEntrada("PARADA:   com espaços   ").motivo === "com espaços", "o motivo vem aparado");
afirmar(lerEntrada("PARADA: com `crases` e #1862").motivo === "com `crases` e #1862", "crases passam inteiras");
afirmar(lerEntrada("PROXIMO: /gm-plan-tasks x").erro === "a última linha não é PARADA:", "PROXIMO: como última linha → erro");
afirmar(lerEntrada("PARADA: x\nPROXIMO: /gm-x y").erro !== undefined, "PARADA: no meio não vale, só a última");
afirmar(lerEntrada("").erro === "entrada vazia", "entrada vazia → erro");
afirmar(lerEntrada(" \r\n \n").erro === "entrada vazia", "só espaço → entrada vazia");
afirmar(lerEntrada("PARADA:").erro === "PARADA sem motivo", "PARADA: sem motivo → erro");
afirmar(lerEntrada("x\nPARADA:   \n\n").erro === "PARADA sem motivo", "PARADA: só com espaço → sem motivo");

console.log(falhas === 0 ? "\nclassificar-parada: tudo ok" : `\nclassificar-parada: ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);

#!/usr/bin/env node
// Testa scripts/classificar-parada.mjs (card #44). Sem rede e sem escrever no repo.
// Uso: node scripts/classificar-parada-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
//
// Por enquanto só as partes puras de C7 e C8 (lista, guarda contra a tabela e leitura da entrada);
// os cenários que passam por `classificar`, `executar` e a CLI entram com as tasks seguintes.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIAS, divergenciaDaLista, lerEntrada, linhasParaDaTabela } from "./classificar-parada.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const convencoes = readFileSync(join(aqui, "..", "skills", "_comum", "convencoes.md"), "utf8");

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}

const mesmaLista = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const linhasDoScript = CATEGORIAS.map((c) => c.linha).filter((linha) => linha !== null);

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

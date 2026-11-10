#!/usr/bin/env node
// Testa scripts/classificar-parada.mjs (card #44). Sem rede e sem escrever no repo.
// Uso: node scripts/classificar-parada-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
//
// C1–C8 rodam no próprio processo, sempre com o Jev falso injetado em `deps.cliente`. O C9 sobe
// processos de verdade, todos no ambiente isolado (sem BRAIN_JEV*, sem a chave, HOME vazio).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CATEGORIAS,
  DESLIGADO,
  classificar,
  daFormaDo42,
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
afirmar(lerEntrada("x\n  PARADA: recuada  \t\n").motivo === "recuada", "espaço à esquerda da última linha passa (achado 8)");
afirmar(lerEntrada("**PARADA:** x").erro === "a última linha não é PARADA:", "`**PARADA:**` em negrito continua recusada");
afirmar(lerEntrada("PARADA: com `crases` e #1862").motivo === "com `crases` e #1862", "crases passam inteiras");
afirmar(lerEntrada("PROXIMO: /gm-plan-tasks x").erro === "a última linha não é PARADA:", "PROXIMO: como última linha → erro");
afirmar(lerEntrada("PARADA: x\nPROXIMO: /gm-x y").erro !== undefined, "PARADA: no meio não vale, só a última");
afirmar(lerEntrada("").erro === "entrada vazia", "entrada vazia → erro");
afirmar(lerEntrada(" \r\n \n").erro === "entrada vazia", "só espaço → entrada vazia");
afirmar(lerEntrada("PARADA:").erro === "PARADA sem motivo", "PARADA: sem motivo → erro");
afirmar(lerEntrada("x\nPARADA:   \n\n").erro === "PARADA sem motivo", "PARADA: só com espaço → sem motivo");

console.log("C9 — o adaptador `daFormaDo42`, contra um cliente com a forma do #42 (sem rede)");
{
  const opcoes = CATEGORIAS.map((c) => c.texto);
  const chamadas = [];
  const falsoDo42 = (resposta, ligado = true) => ({
    ligado: (uso, env) => {
      chamadas.push({ uso, env });
      return ligado;
    },
    decidir: async (estado, perguntas, o) => {
      chamadas.push({ estado, perguntas, o });
      return { escolha: resposta };
    },
  });
  const probabilidades = Object.fromEntries(opcoes.map((o) => [o, 0.01]));
  const env = { SO_PARA_O_TESTE: "1" };

  const cliente = daFormaDo42(falsoDo42({ estado: "ok", tipo: "escolha", escolha: opcoes[0], confianca: 0.5, probabilidades: { ...probabilidades, [opcoes[5]]: 0.9 } }), { env });
  afirmar((await cliente.ligado()) === true && chamadas[0].uso === "parada" && chamadas[0].env === env, "ligado usa o uso `parada` e o env dado");
  const escolhido = await cliente.escolher({ pergunta: "p", texto: "motivo", opcoes });
  afirmar(escolhido.opcao === opcoes[0] && escolhido.probabilidade === 0.5, "vale a `escolha` do Jev com a `confianca` dele, mesmo com outra opção mais alta no mapa (emenda 2)");
  const enviado = chamadas.at(-1);
  afirmar(enviado.estado === "motivo" && enviado.o.uso === "parada" && enviado.perguntas.escolha.tipo === "escolha", "o motivo vai como estado, numa pergunta `escolha` do uso `parada`");
  afirmar(Object.keys(enviado.perguntas.escolha.opcoes).length === 8, "as oito opções vão, cada uma com nome e descrição");

  const semEscolha = daFormaDo42(falsoDo42({ estado: "ok", tipo: "escolha", escolha: "não é opção", confianca: 0.5, probabilidades: { ...probabilidades, [opcoes[5]]: 0.9 } }), { env });
  const pelaMaior = await semEscolha.escolher({ pergunta: "p", texto: "m", opcoes });
  afirmar(pelaMaior.opcao === opcoes[5] && pelaMaior.probabilidade === 0.9, "sem `escolha` válida, vale a maior probabilidade por opção");

  const empate = daFormaDo42(falsoDo42({ estado: "ok", tipo: "escolha", escolha: "não é opção", confianca: 0.4, probabilidades: Object.fromEntries(opcoes.map((o) => [o, 0.4])) }), { env });
  afirmar((await empate.escolher({ pergunta: "p", texto: "m", opcoes })).opcao === opcoes[0], "sem `escolha` válida, empate → a primeira na ordem de CATEGORIAS");

  // O cenário do achado 3: empate entre segundo-revisor e producao, com o Jev escolhendo producao.
  const textoDe = (id) => CATEGORIAS.find((c) => c.id === id).texto;
  const empateReservado = daFormaDo42(
    falsoDo42({ estado: "ok", tipo: "escolha", escolha: textoDe("producao"), confianca: 0.82, probabilidades: { ...probabilidades, [textoDe("segundo-revisor")]: 0.82, [textoDe("producao")]: 0.82 } }),
    { env },
  );
  const reservada = (await classificar("o merge na main é do Leonardo", { cliente: empateReservado })).resultado;
  afirmar(
    reservada.categoria === "producao" && reservada.probabilidade === 0.82 && reservada.escala === true && reservada.porque === "reservada",
    "empate com escolha=producao → sai producao e escala, porque \"reservada\" (achado 3)",
  );

  const semMapa = daFormaDo42(falsoDo42({ estado: "ok", tipo: "escolha", escolha: opcoes[2], confianca: 0.7 }), { env });
  const unica = await semMapa.escolher({ pergunta: "p", texto: "m", opcoes });
  afirmar(unica.opcao === opcoes[2] && unica.probabilidade === 0.7, "sem `probabilidades`, cai em escolha + confianca");

  const fora = daFormaDo42(falsoDo42({ estado: "indisponivel", motivo: "timeout" }), { env });
  const rejeitou = await fora.escolher({ pergunta: "p", texto: "m", opcoes }).then(() => false, () => true);
  afirmar(rejeitou, "`indisponivel` vira rejeição (classificar a escala como erro)");
  const { resultado } = await classificar("m", { cliente: fora });
  afirmar(resultado.estado === "sem-classificacao" && resultado.porque === "erro", "ponta a ponta: indisponivel → sem-classificacao, erro");
  afirmar((await daFormaDo42(falsoDo42(null, false)).ligado()) === false, "desligado do #42 passa como falso");

  // O adaptador padrão de `classificar` recebe o mesmo prazo (achado 9): `deps.jev` troca o módulo
  // do #42, e o falso guarda o `timeoutMs` que chegou ao `decidir`.
  for (const tempoMs of [undefined, 1234, 8000]) {
    const antes = chamadas.length;
    await classificar("m", { jev: falsoDo42({ estado: "ok", tipo: "escolha", escolha: opcoes[1], confianca: 0.9 }), tempoMs });
    const pedido = chamadas.slice(antes).find((chamada) => chamada.o !== undefined);
    afirmar(pedido?.o.timeoutMs === (tempoMs ?? 5000), `o adaptador padrão recebe o tempoMs de classificar (${tempoMs ?? "padrão 5000"})`);
  }
}

console.log("C9 — processos de verdade (R2, CA2)");
const script = join(aqui, "classificar-parada.mjs");
const DESLIGADO_EM_LINHA = '{"estado":"desligado","categoria":null,"probabilidade":null,"escala":null,"porque":null}\n';

// Ambiente isolado: sem NENHUMA fonte de flag ou chave que a spec do #42 nomeia (`BRAIN_JEV`,
// `BRAIN_JEV_FALSO`, `TYPESAFE_API_KEY`; o #42 só as lê do ambiente, não de arquivo), e com os
// diretórios pessoais num diretório vazio, para nada instalado na máquina ser encontrado.
const diretoriosTemporarios = [];
const diretorioVazio = () => {
  const dir = mkdtempSync(join(tmpdir(), "classificar-parada-"));
  diretoriosTemporarios.push(dir);
  return dir;
};
const ambienteIsolado = () => {
  const env = {};
  for (const [nome, valor] of Object.entries(process.env)) {
    if (nome === "TYPESAFE_API_KEY" || nome.startsWith("BRAIN_JEV")) continue;
    env[nome] = valor;
  }
  const vazio = diretorioVazio();
  return { ...env, HOME: vazio, USERPROFILE: vazio, CLAUDE_CONFIG_DIR: vazio };
};

{
  // Todo processo filho que carrega o script roda no ambiente isolado (achado 10 do G4): com
  // BRAIN_JEV e a chave exportados para o CA4, uma regressão na checagem da entrada mandaria o
  // motivo à TypeSafe AI.
  const a = spawnSync(process.execPath, [script], { input: "PROXIMO: /gm-x y", timeout: 4000, encoding: "utf8", env: ambienteIsolado() });
  afirmar(a.status === 2 && a.stdout === "", "(a) PROXIMO: na stdin → status 2 e stdout vazio");

  const b = spawnSync(process.execPath, [script], {
    input: "PARADA: o merge na dev é do Leonardo.\n",
    timeout: 4000,
    encoding: "utf8",
    env: ambienteIsolado(),
  });
  afirmar(b.status === 0, `(b) o cliente real do #42, desligado, sai com status 0 (status ${b.status}, signal ${b.signal})`);
  afirmar(b.stdout === DESLIGADO_EM_LINHA, "(b) a stdout é exatamente a linha `desligado`");

  const c = spawnSync(process.execPath, [script, "qualquer"], { input: "PARADA: x\n", timeout: 4000, encoding: "utf8", env: ambienteIsolado() });
  afirmar(c.status === 2 && c.stdout === "", "(c) um argumento → status 2 e stdout vazio");

  // (d) o cliente ignora o signal e segura o event loop: o processo precisa terminar mesmo assim.
  const dirDoFalso = diretorioVazio();
  const arquivoDoFilho = join(dirDoFalso, "filho.mjs");
  writeFileSync(
    arquivoDoFilho,
    [
      `import { rodarCli } from ${JSON.stringify(pathToFileURL(script).href)};`,
      `import { criarJevFalso } from ${JSON.stringify(pathToFileURL(join(aqui, "jev-falso.mjs")).href)};`,
      `await rodarCli([], { cliente: criarJevFalso({ defeito: "tempo-surdo" }), tempoMs: 200 });`,
      "",
    ].join("\n"),
  );
  const d = spawnSync(process.execPath, [arquivoDoFilho], { input: "PARADA: x\n", timeout: 6000, encoding: "utf8", env: ambienteIsolado() });
  afirmar(d.status === 0 && d.signal === null, `(d) termina com status 0, sem ser morto (status ${d.status}, signal ${d.signal})`);
  afirmar(d.stdout.includes('"porque":"tempo"'), '(d) a stdout diz "porque":"tempo"');
}
for (const dir of diretoriosTemporarios) rmSync(dir, { recursive: true, force: true });

console.log(falhas === 0 ? "\nclassificar-parada: tudo ok" : `\nclassificar-parada: ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);

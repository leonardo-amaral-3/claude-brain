// Sugestão do Jev para a classificação da /gm-triage (card #41).
// Só módulos `node:` de arquivo e caminho. Nenhum módulo de processo ou de rede é importado e este
// arquivo não chama a rede: quando ela existe, é do hooks/jev.js.

import { existsSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const USO = "triagem"; // o uso do #41 na tabela de usos do contrato
export const CAMPOS = ["Tipo", "Severidade", "Classe", "Rota", "Módulo"];
export const LIMIAR_PCT = 70; // porcentagem inteira < 70 → revisar
export const PRAZO_MS = 10000; // timeoutMs passado ao decidir
export const FOLGA_MS = 1000; // guarda do próprio script sobre o decidir
export const MAX_RESUMO = 800; // pontos de código, depois do trim

// Condensam o Step 3 da SKILL.md e a regra de rota do gm-card (skills/gm-card/SKILL.md:128).
// Mudou um critério lá? Mude aqui.
export const INSTRUCOES = {
  Tipo: "Qual o tipo desta demanda?",
  Severidade: "Qual a severidade desta demanda?",
  Classe: "Qual a classe de serviço desta demanda?",
  Rota: "Qual rota de desenvolvimento cabe nesta demanda?",
  "Módulo": "A que módulo do sistema esta demanda pertence?",
};

export const DESCRICOES = {
  // chave = rótulo do ## Board sem o prefixo não alfanumérico
  Tipo: {
    "Bug": "o sistema faz o errado, quebra ou corrompe dado",
    "Dúvida": "a pergunta é como algo funciona hoje; a entrega é a resposta com evidência",
    "Melhoria": "o sistema faz o certo, mas deveria fazer mais ou melhor",
    "Débito técnico": "sem efeito visível para o usuário, mas o custo de mudar a área subiu",
  },
  Severidade: {
    "S1": "parado ou dado corrompido em produção, sem workaround, ou o workaround é reparar dado à mão",
    "S2": "resultado errado ou fluxo travado, com workaround praticável",
    "S3": "incômodo, cosmético, ou dor sem prazo",
  },
  Classe: {
    "Expedite": "S1 real",
    "Data fixa": "há prazo externo",
    "Padrão": "o caso comum, sem prazo externo",
    "Intangível": "débito técnico sem dor externa hoje",
  },
  Rota: {
    "Hotfix": "S1 em produção",
    "Curta": "não muda contrato de API, schema nem regra de negócio; diff pequeno; reverte trivialmente",
    "Completa": "todo o resto",
  },
};

// Rótulo sem o prefixo não alfanumérico (o emoji do ## Board).
const semPrefixo = (r) => r.replace(/^[^\p{L}\p{N}]+/u, "");

// Descrição de um rótulo enviada ao Jev. O Módulo usa sempre o próprio rótulo.
const descricao = (campo, rotulo) => DESCRICOES[campo]?.[semPrefixo(rotulo)] ?? rotulo;

// Tira o BOM inicial, unifica quebras de linha e aplica NFC.
export function normalizar(texto) {
  return String(texto).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").normalize("NFC");
}

// Lê os rótulos dos cinco campos na seção `## Board` do CLAUDE.md.
// Campo sem linha, ou com linha sem nenhum rótulo, fica fora do mapa.
export function lerBoard(texto) {
  const linhas = normalizar(texto).split("\n");
  const ini = linhas.indexOf("## Board");
  const mapa = new Map();
  if (ini === -1) return mapa;
  let fim = linhas.length;
  for (let i = ini + 1; i < linhas.length; i++) {
    if (linhas[i].startsWith("## ")) {
      fim = i;
      break;
    }
  }
  const secao = linhas.slice(ini + 1, fim);
  for (const nome of CAMPOS) {
    const re = new RegExp("^- \\*\\*" + nome + "\\*\\* field `[^`]+`:\\s*(.+)$");
    for (const linha of secao) {
      const m = re.exec(linha);
      if (!m) continue;
      const rotulos = [];
      for (const pedaco of m[1].split(" · ")) {
        // o que vem depois do id (um comentário, o ponto final) não tira a opção da lista
        const r = /^(.+?)=`[^`]+`/.exec(pedaco.trim());
        if (r) rotulos.push(r[1].trim());
      }
      if (rotulos.length > 0) mapa.set(nome, rotulos);
      break;
    }
  }
  return mapa;
}

// Guarda grosseira de propósito: segura o deslize óbvio, não substitui a regra do Step 4b.
// Devolve o nome do primeiro padrão que casar, ou null.
const PADROES_SENSIVEIS = [
  ["e-mail", /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/],
  ["URL", /\bhttps?:\/\/|\bwww\./i],
  // ~/, as raízes conhecidas e o drive do Windows; e, em qualquer raiz, três segmentos ou mais, ou um
  // arquivo com extensão. Rota de API (/api/aih) e nome de skill (/gm-triage/jev) continuam passando.
  [
    "caminho absoluto",
    /(^|[\s("'=])(~\/|\/(?:home|Users|tmp|var|etc|opt|mnt|srv|root)\/)|\b[A-Za-z]:[\\/]|(^|[\s("'=])\/[\p{L}\p{N}_.\-]+\/[\p{L}\p{N}_.\-]+\/|(^|[\s("'=])\/(?:[\p{L}\p{N}_.\-]+\/)*[\p{L}\p{N}_\-]+\.[\p{L}\p{N}]{1,6}(?![\p{L}\p{N}])/u,
  ],
  // ./ e ../; e três segmentos ou mais com uma sequência de três letras (logs/<pasta>/erro.txt), o que
  // deixa passar o período 10/2026-11/2026 e um arquivo do repo com uma barra só (hooks/brain-contexto.js).
  ["caminho relativo", /(^|[\s("'=])\.{1,2}[\\/]|(?<![\p{L}\p{N}_.\/\-])(?=[\p{L}\p{N}_.\/\-]*\p{L}{3})[\p{L}\p{N}_.\-]+\/[\p{L}\p{N}_.\-]+\//u],
  // DDD e número com hífen: pega o fixo de 10 dígitos, que o "número longo" não alcança.
  ["telefone", /(?:\(\d{2}\)|\b\d{2})\s?\d{4,5}-\d{4}\b/],
  // Onze dígitos ou mais. Entre eles valem . - ( ) (até dois), a / depois de um grupo de 3+ dígitos
  // (CNPJ, e não MM/AAAA) e o espaço, com ")" antes ou "(" depois, entre grupos de até 5 dígitos
  // (CNS, telefone, CPF espaçado, e não a competência de 6). Na dúvida, recusa: um resumo recusado
  // só deixa de mostrar a sugestão.
  ["número longo", /(?:\d(?:[.\-()]{1,2}|(?<=\d{3})\/|(?<!\d{6})\)? (?=\(?\d{1,5}(?!\d))\(?)?){11,}/],
  ["stack trace", /\bat \S+ ?\(?[^()\s]+:\d+(?::\d+)?\)?|Traceback \(most recent call last\)/],
];

export function sensivel(resumo) {
  const texto = String(resumo ?? "");
  for (const [nome, re] of PADROES_SENSIVEIS) if (re.test(texto)) return nome;
  return null;
}

// Chave de comparação entre a proposta da sessão e os rótulos do ## Board: sem U+FE0F, sem o
// prefixo não alfanumérico (o emoji), sem diferença de caixa.
const chave = (x) => semPrefixo(String(x).normalize("NFC").replace(/\uFE0F/g, "").trim()).toLowerCase();

const pct = (p) => Math.floor(p * 100 + 1e-9);

const primeiraLinha = (e, max) => String(e?.message ?? e).split("\n")[0].slice(0, max);

const prazoEmSegundos = (ms) => {
  const s = ms / 1000;
  return Number.isInteger(s) ? String(s) : s.toLocaleString("pt-BR");
};

const falhou = (motivo, ms) => (ms === undefined ? { estado: "falhou", motivo } : { estado: "falhou", motivo, ms });

const campoVazio = (campo, proposta, nota, extra = {}) => ({
  campo,
  proposta,
  pProposta: null,
  escolha: null,
  pEscolha: null,
  revisar: false,
  nota,
  ...extra,
});

// Pede ao Jev, numa chamada só, a escolha de cada campo e devolve a leitura pronta para renderizar.
// `cliente` tem a forma do hooks/jev.js: ligado(uso, env) e decidir(estado, perguntas, opcoes).
export async function sugerir({ opcoes, entrada, cliente, prazoMs = PRAZO_MS, folgaMs = FOLGA_MS }) {
  // 1. desligado é tudo o que não prova ligado === true
  try {
    if (!cliente || cliente.ligado(USO, process.env) !== true) return { estado: "desligado" };
  } catch {
    return { estado: "desligado" };
  }

  // 2. o resumo
  const resumo = String(entrada?.resumo ?? "").trim();
  if (resumo === "") return falhou("o resumo para o Jev veio vazio");
  if ([...resumo].length > MAX_RESUMO) return falhou(`o resumo para o Jev passou de ${MAX_RESUMO} caracteres`);
  const achado = sensivel(resumo);
  if (achado) return falhou(`o resumo parece ter ${achado}; nada foi enviado`);

  // 3. um item por campo: pergunta, única opção, ou nota
  const perguntas = {};
  const itens = new Map(); // campo → item pronto, ou { pendente, proposta, rotulos }
  for (const campo of CAMPOS) {
    let proposta = entrada?.proposta?.[campo] ?? null;
    const rotulos = opcoes?.get(campo);
    if (!rotulos || rotulos.length === 0) {
      itens.set(campo, campoVazio(campo, proposta, "não declarado no ## Board"));
      continue;
    }
    if (proposta !== null && !rotulos.includes(proposta)) {
      const alvo = chave(proposta);
      const iguais = rotulos.filter((r) => chave(r) === alvo);
      if (iguais.length === 1) proposta = iguais[0];
    }
    const dentro = proposta !== null && rotulos.includes(proposta);
    if (rotulos.length === 1) {
      const unico = rotulos[0];
      if (proposta === null || dentro) {
        itens.set(campo, {
          campo,
          proposta,
          pProposta: proposta === null ? null : 100,
          escolha: unico,
          pEscolha: 100,
          revisar: false,
          nota: "única opção",
        });
      } else {
        itens.set(campo, {
          campo,
          proposta,
          pProposta: null,
          escolha: unico,
          pEscolha: 100,
          revisar: true,
          nota: "proposta fora do ## Board",
        });
      }
      continue;
    }
    perguntas[campo] = {
      tipo: "escolha",
      instrucao: INSTRUCOES[campo],
      opcoes: Object.fromEntries(rotulos.map((r) => [r, descricao(campo, r)])),
    };
    itens.set(campo, { pendente: true, proposta, dentro });
  }

  // 4. uma chamada só, com guarda de tempo própria
  const perguntados = CAMPOS.filter((c) => c in perguntas);
  let ms = 0;
  let resultado = null;
  if (perguntados.length > 0) {
    const inicio = performance.now();
    let temporizador;
    const estouro = Symbol("estouro");
    const prazo = new Promise((resolve) => {
      temporizador = setTimeout(() => resolve(estouro), prazoMs + folgaMs);
    });
    try {
      const chamada = Promise.resolve().then(() => cliente.decidir(resumo, perguntas, { uso: USO, timeoutMs: prazoMs }));
      resultado = await Promise.race([chamada, prazo]);
      ms = Math.round(performance.now() - inicio);
      if (resultado === estouro) return falhou(`o Jev não respondeu em ${prazoEmSegundos(prazoMs)} s`, ms);
    } catch (e) {
      ms = Math.round(performance.now() - inicio);
      return falhou(`o cliente do Jev falhou: ${primeiraLinha(e, 120)}`, ms);
    } finally {
      clearTimeout(temporizador);
    }

    const invalida = (campo) => falhou(`resposta inválida do Jev no campo ${campo}`, ms);
    if (resultado === null || typeof resultado !== "object" || !perguntados.some((c) => c in resultado)) {
      return invalida(perguntados[0]);
    }
    const prob = (p) => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1;
    for (const campo of perguntados) {
      const r = resultado[campo];
      if (r && typeof r === "object" && r.estado === "indisponivel") {
        const detalhe = r.detalhe ? `: ${String(r.detalhe).slice(0, 60)}` : "";
        return falhou(`o Jev ficou indisponível (${r.motivo}${detalhe})`, ms);
      }
      const item = itens.get(campo);
      const enviadas = perguntas[campo].opcoes;
      if (
        !r ||
        typeof r !== "object" ||
        r.estado !== "ok" ||
        typeof r.escolha !== "string" ||
        !Object.hasOwn(enviadas, r.escolha) ||
        !r.probabilidades ||
        typeof r.probabilidades !== "object" ||
        !prob(r.probabilidades[r.escolha]) ||
        (item.dentro && !prob(r.probabilidades[item.proposta]))
      ) {
        return invalida(campo);
      }
    }
  }

  // 5. porcentagens inteiras e a marca, sobre o valor já arredondado
  const campos = CAMPOS.map((campo) => {
    const item = itens.get(campo);
    if (!item.pendente) return item;
    const r = resultado[campo];
    const pEscolha = pct(r.probabilidades[r.escolha]);
    if (item.dentro) {
      const pProposta = pct(r.probabilidades[item.proposta]);
      return { campo, proposta: item.proposta, pProposta, escolha: r.escolha, pEscolha, revisar: pProposta < LIMIAR_PCT, nota: null };
    }
    if (item.proposta === null) {
      return { campo, proposta: null, pProposta: null, escolha: r.escolha, pEscolha, revisar: pEscolha < LIMIAR_PCT, nota: null };
    }
    return {
      campo,
      proposta: item.proposta,
      pProposta: null,
      escolha: r.escolha,
      pEscolha,
      revisar: true,
      nota: "proposta fora do ## Board",
    };
  });
  return { estado: "ligado", ms, campos };
}

const CABECALHO =
  "**Sugestão do Jev** — só leitura, nada disto é gravado. `⚠ revisar` = o Jev dá menos de 70% ao valor proposto.\n\n" +
  "| Campo | Proposta da sessão | Jev nela | Escolha do Jev | |\n" +
  "|---|---|---|---|---|";

function linha(c) {
  const dash = "—";
  const celulas = [c.campo, c.proposta ?? dash];
  let marca = c.revisar ? "⚠ revisar" : "";
  if (c.nota === "não declarado no ## Board") {
    celulas.push(dash, dash);
    marca = "não declarado no `## Board`";
  } else if (c.nota === "única opção") {
    celulas.push(c.proposta === null ? dash : "100% (única opção)", c.proposta === null || c.proposta !== c.escolha ? `${c.escolha} (100%)` : "=");
  } else {
    celulas.push(c.pProposta === null ? dash : `${c.pProposta}%`, c.escolha === c.proposta ? "=" : `${c.escolha} (${c.pEscolha}%)`);
    if (c.nota === "proposta fora do ## Board") marca = "⚠ revisar (proposta fora do `## Board`)";
  }
  return `| ${celulas.join(" | ")} |${marca ? ` ${marca} |` : " |"}`;
}

export function renderizar(resultado) {
  if (resultado?.estado === "falhou") {
    return `Sem a sugestão do Jev: ${resultado.motivo}. A classificação acima é só a da sessão.`;
  }
  if (resultado?.estado !== "ligado") return "";
  return [CABECALHO, ...resultado.campos.map(linha)].join("\n");
}

const USO_CLI = "uso: jev-triagem.mjs --estado | --claude-md <arquivo> --entrada <arquivo>";

// Resolve o hooks/jev.js: primeiro o do próprio repo (ou da instalação, que é o mesmo caminho),
// depois o de <CLAUDE_HOME>. Um require que falha no caminho escolhido não tenta o outro.
export function carregarCliente() {
  const local = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "jev.js");
  let caminho = local;
  if (!existsSync(caminho)) {
    caminho = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "hooks", "jev.js");
    if (!existsSync(caminho)) return { cliente: null, motivo: "jev.js não instalado" };
  }
  try {
    return { cliente: createRequire(import.meta.url)(caminho), motivo: null };
  } catch (e) {
    return { cliente: null, motivo: primeiraLinha(e, 120) };
  }
}

// Só ["--estado"] e --claude-md <a> --entrada <b> (qualquer ordem, nada a mais). Senão, null.
function lerArgv(argv) {
  if (!Array.isArray(argv)) return null;
  if (argv.length === 1 && argv[0] === "--estado") return { estado: true };
  if (argv.length !== 4) return null;
  const mapa = {};
  for (let i = 0; i < 4; i += 2) {
    const flag = argv[i];
    if ((flag !== "--claude-md" && flag !== "--entrada") || flag in mapa) return null;
    mapa[flag] = argv[i + 1];
  }
  return { claudeMd: mapa["--claude-md"], entrada: mapa["--entrada"] };
}

// Só o arquivo que o Step 4b cria é apagado: gm-triage-jev-<8 hex>.json direto na pasta temporária
// do sistema. Qualquer outro --entrada (argumentos trocados, caminho errado) fica onde está.
const NOME_ENTRADA = /^gm-triage-jev-[0-9a-f]{8}\.json$/;
const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};
const apagavel = (arquivo) =>
  NOME_ENTRADA.test(basename(arquivo)) && real(dirname(resolve(arquivo))) === real(tmpdir());

const apagar = (arquivo, stderr) => {
  if (!apagavel(arquivo)) {
    stderr.write(`jev-triagem: não apaguei ${basename(arquivo)}: só apago gm-triage-jev-<8 hex>.json da pasta temporária\n`);
    return;
  }
  try {
    unlinkSync(arquivo);
  } catch {}
};

export async function principal(argv, { carregar = carregarCliente, stdout = process.stdout, stderr = process.stderr } = {}) {
  const args = lerArgv(argv);
  if (!args) {
    stderr.write(USO_CLI + "\n");
    return 2;
  }

  const { cliente, motivo } = carregar();
  let ligado = false;
  try {
    ligado = cliente?.ligado(USO, process.env) === true;
  } catch {
    ligado = false;
  }

  if (args.estado) {
    if (ligado) stdout.write("ligado\n");
    else stderr.write(diagnostico(cliente, motivo));
    return 0;
  }

  if (!ligado) {
    stderr.write(diagnostico(cliente, motivo));
    apagar(args.entrada, stderr); // sem ler
    return 0;
  }

  let entrada = null;
  let resultado = null;
  try {
    try {
      entrada = JSON.parse(readFileSync(args.entrada, "utf8"));
    } catch {
      resultado = falhou(`não consegui ler ${basename(args.entrada)}`);
    }
  } finally {
    apagar(args.entrada, stderr);
  }
  let opcoes = null;
  if (!resultado) {
    try {
      opcoes = lerBoard(readFileSync(args.claudeMd, "utf8"));
    } catch {
      resultado = falhou(`não consegui ler ${basename(args.claudeMd)}`);
    }
  }
  if (!resultado && opcoes.size === 0) resultado = falhou(`não achei o ## Board em ${basename(args.claudeMd)}`);
  if (!resultado) resultado = await sugerir({ opcoes, entrada, cliente });

  const texto = renderizar(resultado);
  if (texto !== "") stdout.write(texto + "\n");
  if (resultado.ms !== undefined) stderr.write(`jev-triagem: ${resultado.ms} ms\n`);
  return 0;
}

const diagnostico = (cliente, motivo) =>
  cliente ? "jev-triagem: cliente carregado, desligado\n" : `jev-triagem: cliente indisponível: ${motivo}\n`;

// Bloco de execução: só quando este arquivo é o process.argv[1]; importado (teste, node -e) não roda nada.
const sair = (codigo) => process.stdout.write("", () => process.exit(codigo));

const eExecutavel = () => {
  try {
    return Boolean(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};

if (eExecutavel()) {
  principal(process.argv.slice(2)).then(sair, (e) => {
    process.stderr.write("jev-triagem: erro interno: " + primeiraLinha(e, 120) + "\n");
    sair(1);
  });
}

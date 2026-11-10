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
// Por que a falha fecha (fail-closed): com o Jev ligado, quem lê a saída espera que o classificador
// funcione. Erro, tempo esgotado, resposta inválida e lista divergente escalam, cada um com o seu
// `porque`; nenhum deles vira `desligado`, porque uma falha silenciosa devolveria a parada à leitura
// de hoje justamente quando algo está quebrado.
//
// Este arquivo ainda não tem o cliente do Jev nem a CLI: `classificar`, `executar` e `rodarCli`
// entram nas tasks seguintes do card. Aqui está o núcleo puro, que não toca rede nem disco.

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
// no fim; aqui pula) e exige `PARADA:` nela. → { motivo } | { erro }
export function lerEntrada(texto) {
  const linhas = comoLF(texto).split("\n");
  const ultima = linhas.findLast((linha) => linha.trim() !== "");
  if (ultima === undefined) return { erro: "entrada vazia" };

  const casou = /^PARADA:\s*(.*)$/.exec(ultima);
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

// Sugestão do Jev para a classificação da /gm-triage (card #41).
// Só módulos `node:` de arquivo e caminho. Nenhum módulo de processo ou de rede é importado e este
// arquivo não chama a rede: quando ela existe, é do hooks/jev.js.

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
  return String(texto).replace(/^﻿/, "").replace(/\r\n?/g, "\n").normalize("NFC");
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
        const r = /^(.+?)=`[^`]+`$/.exec(pedaco.trim());
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
  ["caminho absoluto", /(^|[\s("'])(~\/|\/(?:home|Users|tmp|var|etc|opt|mnt|srv|root)\/)|\b[A-Za-z]:[\\/]/],
  ["número longo", /(?:\d[.\-()]{0,2}){11,}/],
  ["stack trace", /\bat \S+ ?\(?[^()\s]+:\d+(?::\d+)?\)?|Traceback \(most recent call last\)/],
];

export function sensivel(resumo) {
  const texto = String(resumo ?? "");
  for (const [nome, re] of PADROES_SENSIVEIS) if (re.test(texto)) return nome;
  return null;
}

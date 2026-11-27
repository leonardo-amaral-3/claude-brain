#!/usr/bin/env node
// Carimba as seções de skills/_comum/convencoes.md em toda skills/gm-*/SKILL.md que já tenha os
// cabeçalhos — todos ou nenhum — e as de skills/_comum/opcionais.md onde a skill tem o cabeçalho. Sem flag: escreve o que mudou. `--check`: só compara.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

function erro(msg) {
  console.error(msg);
  process.exit(2);
}

// Lê UTF-8 sem normalizar BOM/CRLF em silêncio — o repo é LF por .gitattributes.
function lerUtf8(caminho) {
  const buf = readFileSync(caminho);
  const texto = buf.toString("utf8");
  if (texto.charCodeAt(0) === 0xfeff) erro(`${caminho}: tem BOM, não normalizo em silêncio`);
  if (texto.includes("\r\n")) erro(`${caminho}: tem CRLF, não normalizo em silêncio`);
  return texto;
}

// Marca, linha a linha, se ela está fora de uma cerca de código (``` ou ~~~, indentada ou não).
// Uma linha de citação ("> ...") nunca abre nem fecha cerca.
function marcarForaDeCerca(linhas) {
  let dentro = false;
  return linhas.map((linha) => {
    const foraDeCerca = !dentro;
    if (/^\s*(```|~~~)/.test(linha)) dentro = !dentro;
    return foraDeCerca;
  });
}

// Extrai as seções `## ` de um texto, ignorando o que vem antes da primeira e tudo que está
// dentro de cerca. Cada seção carrega seu cabeçalho e o corpo até a próxima (ou EOF), sem espaço
// em branco final.
function extrairSecoes(texto, origem) {
  const linhas = texto.split("\n");
  const foraDeCerca = marcarForaDeCerca(linhas);
  const cabecalhos = [];
  for (let i = 0; i < linhas.length; i++) {
    if (foraDeCerca[i] && linhas[i].startsWith("## ")) cabecalhos.push(i);
  }
  const vistos = new Set();
  const secoes = [];
  for (let k = 0; k < cabecalhos.length; k++) {
    const h = cabecalhos[k];
    const cabecalho = linhas[h];
    if (vistos.has(cabecalho)) erro(`${origem}: cabeçalho repetido — ${cabecalho}`);
    vistos.add(cabecalho);
    const fimExclusivo = k + 1 < cabecalhos.length ? cabecalhos[k + 1] : linhas.length;
    let corpo = linhas.slice(h + 1, fimExclusivo);
    while (corpo.length && corpo[corpo.length - 1].trim() === "") corpo.pop();
    secoes.push({ cabecalho, texto: [cabecalho, ...corpo].join("\n") });
  }
  return secoes;
}

// Acha, num alvo, a linha igual a um cabeçalho, fora de cerca. Duas vezes é erro fatal.
function acharCabecalho(linhas, foraDeCerca, cabecalho, origem) {
  const achados = [];
  for (let i = 0; i < linhas.length; i++) {
    if (foraDeCerca[i] && linhas[i] === cabecalho) achados.push(i);
  }
  if (achados.length > 1) erro(`${origem}: cabeçalho "${cabecalho}" aparece duas vezes`);
  return achados.length === 1 ? achados[0] : -1;
}

function proximoCabecalhoForaDeCerca(linhas, foraDeCerca, apos) {
  for (let i = apos + 1; i < linhas.length; i++) {
    if (foraDeCerca[i] && linhas[i].startsWith("## ")) return i;
  }
  return undefined;
}

function regiaoAtual(linhas, inicio, fimExclusivo) {
  return linhas.slice(inicio, fimExclusivo ?? linhas.length);
}

function arraysIguais(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// --- detector de duplicação (R4.1) ---
// 9 palavras seguidas (minúsculas, sem ` * _ > |, espaços colapsados) de uma fonte do _comum fora dos
// blocos carimbados são a fonte repetida à mão: acusa `skill:linha`, o trecho, e o --check sai 1.
const TAMANHO_GRAMA = 9;
const palavrasDe = (linha) =>
  linha.toLowerCase().replace(/[`*_>|]/g, "").split(/\s+/).filter(Boolean);

function gramasDasFontes(fontes) {
  const mapa = new Map(); // grama → "arquivo · ## seção"
  for (const { arquivo, secoes } of fontes) {
    for (const secao of secoes) {
      const palavras = palavrasDe(secao.texto.split("\n").slice(1).join("\n"));
      for (let i = 0; i + TAMANHO_GRAMA <= palavras.length; i++) {
        const grama = palavras.slice(i, i + TAMANHO_GRAMA).join(" ");
        if (!mapa.has(grama)) mapa.set(grama, `${arquivo} · ${secao.cabecalho}`);
      }
    }
  }
  return mapa;
}

// → [{ linha, trecho, fonte }]: uma entrada por trecho contínuo repetido, na linha onde começa.
// As linhas de dentro dos blocos carimbados quebram a sequência: um trecho não atravessa um bloco.
function duplicacoesForaDosBlocos(linhas, intervalosCarimbados, gramas) {
  const dentro = (i) => intervalosCarimbados.some(([ini, fim]) => i >= ini && i < fim);
  const achados = [];
  let palavras = [];
  const varrer = () => {
    let corrente = null;
    for (let i = 0; i + TAMANHO_GRAMA <= palavras.length; i++) {
      const fonte = gramas.get(palavras.slice(i, i + TAMANHO_GRAMA).map((x) => x.w).join(" "));
      if (!fonte) continue;
      if (corrente && i <= corrente.fim && fonte === corrente.fonte) corrente.fim = i + TAMANHO_GRAMA;
      else achados.push((corrente = { inicio: i, fim: i + TAMANHO_GRAMA, fonte, palavras }));
    }
    palavras = [];
  };
  for (let i = 0; i < linhas.length; i++) {
    if (dentro(i)) varrer();
    else for (const w of palavrasDe(linhas[i])) palavras.push({ w, linha: i + 1 });
  }
  varrer();
  return achados.map(({ inicio, fim, fonte, palavras: ps }) => {
    const trecho = ps.slice(inicio, Math.min(fim, inicio + 14)).map((x) => x.w).join(" ");
    return { linha: ps[inicio].linha, trecho: fim - inicio > 14 ? `${trecho} …` : trecho, fonte };
  });
}

// --- fonte ---
const caminhoFonte = join(root, "skills", "_comum", "convencoes.md");
const textoFonte = lerUtf8(caminhoFonte);
const secoesFonte = extrairSecoes(textoFonte, "skills/_comum/convencoes.md");
if (secoesFonte.length === 0) erro("skills/_comum/convencoes.md: nenhuma seção `## ` encontrada");

// Fonte opcional: cada seção vale só onde a skill já tem o cabeçalho (sem "todos ou nenhum").
const secoesOpcionais = extrairSecoes(lerUtf8(join(root, "skills", "_comum", "opcionais.md")), "skills/_comum/opcionais.md");
for (const o of secoesOpcionais) {
  if (secoesFonte.some((s) => s.cabecalho === o.cabecalho)) {
    erro(`cabeçalho "${o.cabecalho}" está em convencoes.md e em opcionais.md — um bloco tem uma fonte só`);
  }
}

const gramasDasFontesComuns = gramasDasFontes([
  { arquivo: "convencoes.md", secoes: secoesFonte },
  { arquivo: "opcionais.md", secoes: secoesOpcionais },
]);

// --- alvos ---
const skillsDir = join(root, "skills");
const nomesSkills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("gm-"))
  .map((d) => d.name)
  .sort();

let algumDivergenteOuQuebrado = false;
let skillsComBlocos = 0;

for (const nome of nomesSkills) {
  const caminho = join(skillsDir, nome, "SKILL.md");
  const origem = `skills/${nome}/SKILL.md`;
  const textoOriginal = lerUtf8(caminho);
  const linhas = textoOriginal.split("\n");
  const foraDeCerca = marcarForaDeCerca(linhas);

  const posicoes = secoesFonte.map((s) => acharCabecalho(linhas, foraDeCerca, s.cabecalho, origem));
  const presentes = posicoes.filter((p) => p !== -1).length;

  if (check) {
    const cabecalhosDosBlocos = [...secoesFonte, ...secoesOpcionais].map((sec) => sec.cabecalho);
    const intervalos = cabecalhosDosBlocos
      .map((c) => acharCabecalho(linhas, foraDeCerca, c, origem))
      .filter((h) => h !== -1)
      .map((h) => [h, proximoCabecalhoForaDeCerca(linhas, foraDeCerca, h) ?? linhas.length]);
    for (const d of duplicacoesForaDosBlocos(linhas, intervalos, gramasDasFontesComuns)) {
      console.log(`${origem}:${d.linha} · trecho de ${d.fonte} repetido fora do bloco: «${d.trecho}»`);
      algumDivergenteOuQuebrado = true;
    }
  }

  if (presentes === 0) {
    console.log(`${nome}: sem bloco`);
    continue;
  }
  // Todos ou nenhum: skill com parte dos cabeçalhos é cabeçalho digitado errado ou esquecido, e
  // carimbá-la escreveria com posição -1.
  if (presentes < secoesFonte.length) {
    const faltam = secoesFonte.filter((_, k) => posicoes[k] === -1).map((s) => s.cabecalho.slice(3));
    console.log(`${nome}: blocos incompletos (falta ${faltam.join(", ")})`);
    algumDivergenteOuQuebrado = true;
    continue;
  }

  skillsComBlocos++;
  const substituicoes = [];
  // Comuns (todas presentes, por cima) e opcionais (só as que a skill já tem).
  const alvos = secoesFonte.map((secao, k) => ({ secao, h: posicoes[k] }));
  for (const secao of secoesOpcionais) {
    const h = acharCabecalho(linhas, foraDeCerca, secao.cabecalho, origem);
    if (h !== -1) alvos.push({ secao, h });
  }
  for (const { secao, h } of alvos) {
    const proximo = proximoCabecalhoForaDeCerca(linhas, foraDeCerca, h);
    const atual = regiaoAtual(linhas, h, proximo);
    const nova = [...secao.texto.split("\n"), ""];
    const igual = arraysIguais(atual, nova);

    if (check) {
      console.log(`${nome} · ${secao.cabecalho.slice(3)} · ${igual ? "igual" : "divergente"}`);
      if (!igual) algumDivergenteOuQuebrado = true;
    } else {
      console.log(`${nome} · ${secao.cabecalho.slice(3)} · ${igual ? "igual" : "carimbado"}`);
      if (!igual) substituicoes.push({ h, fimExclusivo: proximo, nova });
    }
  }

  if (!check && substituicoes.length > 0) {
    // Na ordem em que os blocos aparecem na skill, não na da fonte.
    substituicoes.sort((a, b) => a.h - b.h);
    const partes = [];
    let cursor = 0;
    for (const s of substituicoes) {
      partes.push(...linhas.slice(cursor, s.h));
      partes.push(...s.nova);
      cursor = s.fimExclusivo ?? linhas.length;
    }
    partes.push(...linhas.slice(cursor));
    writeFileSync(caminho, partes.join("\n"));
  }
}

if (check) {
  if (!algumDivergenteOuQuebrado) {
    console.log(`${skillsComBlocos} skills × ${secoesFonte.length} blocos iguais à fonte`);
    process.exit(0);
  }
  process.exit(1);
}

process.exit(algumDivergenteOuQuebrado ? 1 : 0);

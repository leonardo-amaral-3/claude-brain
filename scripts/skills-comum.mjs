#!/usr/bin/env node
// Carimba as seções de skills/_comum/convencoes.md em toda skills/gm-*/SKILL.md que já tenha os
// cabeçalhos — todos ou nenhum. Sem flag: escreve o que mudou. `--check`: só compara.
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

// --- fonte ---
const caminhoFonte = join(root, "skills", "_comum", "convencoes.md");
const textoFonte = lerUtf8(caminhoFonte);
const secoesFonte = extrairSecoes(textoFonte, "skills/_comum/convencoes.md");
if (secoesFonte.length === 0) erro("skills/_comum/convencoes.md: nenhuma seção `## ` encontrada");

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
  for (let k = 0; k < secoesFonte.length; k++) {
    const secao = secoesFonte[k];
    const h = posicoes[k];
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

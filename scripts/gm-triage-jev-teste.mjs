#!/usr/bin/env node
// Testa skills/gm-triage/jev-triagem.mjs (card #41), sem rede e sem chave.
// Uso: node scripts/gm-triage-jev-teste.mjs     sai 0 se todos os casos passam, 1 se algum falha.
//
// Antes de qualquer caso o env perde as variáveis do Jev e o fetch passa a lançar: este script nunca
// pode falar com a TypeSafe AI nem herdar a chave. O estado "ligado" vem só do falso (BRAIN_JEV_FALSO).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const root = join(aqui, "..");
const require = createRequire(import.meta.url);

let envSemJev;
try {
  ({ envSemJev } = require(join(root, "hooks", "jev.js")));
  if (typeof envSemJev !== "function") throw new Error("sem envSemJev");
} catch {
  console.error("FALHOU: hooks/jev.js do #42 ausente (rode depois do rebase sobre a feat/42-filtro-jev)");
  process.exit(1);
}
process.env = envSemJev(process.env);
globalThis.fetch = () => {
  throw new Error("rede proibida no teste");
};

const { USO, CAMPOS, LIMIAR_PCT, PRAZO_MS, FOLGA_MS, MAX_RESUMO, INSTRUCOES, DESCRICOES, normalizar, lerBoard, sensivel } =
  await import("../skills/gm-triage/jev-triagem.mjs");

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const objeto = (mapa) => Object.fromEntries(mapa);

// --- constantes ---
console.log("constantes");
afirmar(USO === "triagem" && igual(CAMPOS, ["Tipo", "Severidade", "Classe", "Rota", "Módulo"]), "USO e CAMPOS");
afirmar(LIMIAR_PCT === 70 && PRAZO_MS === 10000 && FOLGA_MS === 1000 && MAX_RESUMO === 800, "limiar, prazo, folga e máximo do resumo");
afirmar(CAMPOS.every((c) => typeof INSTRUCOES[c] === "string") && typeof DESCRICOES.Tipo.Bug === "string", "INSTRUCOES e DESCRICOES");

// --- R3: lerBoard ---
console.log("R3: lerBoard");
const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");
const board = lerBoard(claudeMd);
afirmar(igual(board.get("Módulo"), ["brain-mcp", "hooks", "skills", "docs"]), "Módulo do CLAUDE.md do repo");
afirmar(igual(board.get("Rota"), ["Completa", "Curta", "Hotfix"]), "Rota do CLAUDE.md do repo");
afirmar(igual(board.get("Tipo"), ["🐞 Bug", "❓ Dúvida", "✨ Melhoria", "🧰 Débito técnico"]), "Tipo com os quatro rótulos com emoji");
afirmar(igual(board.get("Severidade"), ["S1", "S2", "S3"]), "Severidade");
afirmar(igual(board.get("Classe"), ["🔴 Expedite", "📅 Data fixa", "⚪ Padrão", "🔧 Intangível"]), "Classe");
afirmar(!board.has("Status") && board.size === 5, "Status fica fora do mapa");

const ref = objeto(board);
const comCrlf = claudeMd.replace(/\n/g, "\r\n");
afirmar(igual(objeto(lerBoard(comCrlf)), ref), "mesmo mapa com CRLF");
afirmar(igual(objeto(lerBoard("\uFEFF" + claudeMd)), ref), "mesmo mapa com BOM");
afirmar(igual(objeto(lerBoard(claudeMd.replace(/\*\*Módulo\*\*/g, "**Módulo**".normalize("NFD")))), ref), "mesmo mapa com Módulo em NFD");
afirmar(normalizar("\uFEFFa\r\nb\rc") === "a\nb\nc", "normalizar: BOM, CRLF e CR");

// formato do ~/pessoal/CLAUDE.md: uma opção só no Módulo; campo sem linha fica fora
const fixtura = [
  "# x",
  "## Board",
  "- **Tipo** field `PVTSSF_x`: 🐞 Bug=`a1` · ✨ Melhoria=`b2`",
  "- **Módulo** field `PVTSSF_y`: Comum=`c3`",
  "- **Rota** field `PVTSSF_z`:",
  "## Outra",
  "- **Severidade** field `PVTSSF_w`: S1=`d4`",
].join("\n");
const mFix = lerBoard(fixtura);
afirmar(igual(mFix.get("Módulo"), ["Comum"]), "fixture: Módulo com uma opção só");
afirmar(!mFix.has("Rota"), "fixture: linha sem rótulo fica fora");
afirmar(!mFix.has("Severidade"), "fixture: o que está depois do próximo ## não é lido");
afirmar(lerBoard("# sem board\n- **Tipo** field `x`: A=`1`").size === 0, "sem ## Board → mapa vazio");

// --- sensivel ---
console.log("sensivel");
const casam = [
  ["ver fulano@exemplo.com.br", "e-mail"],
  ["em https://x.y", "URL"],
  ["arquivo /home/u/a.txt", "caminho absoluto"],
  ["C:/Users/x", "caminho absoluto"],
  ["CPF 123.456.789-09", "número longo"],
  ["CNS 898001234567890", "número longo"],
  ["AIH 3524100012345", "número longo"],
  ["erro at f (a.js:1:2) no meio", "stack trace"],
  ["at com.foo.Bar.run(Bar.java:42)", "stack trace"],
];
for (const [texto, padrao] of casam) afirmar(sensivel(texto) === padrao, `casa ${padrao}: ${texto}`);
const naoCasam = [
  "x".repeat(795) + "😀😀😀😀😀",
  "atualizar better-sqlite3@11.5.0 quebra o build",
  "a rota /api/aih retorna 500",
  "o slash /gm-triage/jev",
  "competências 202610 202611 e 202612",
  "período 10/2026-11/2026",
  "cita hooks/brain-contexto.js",
  "às 10:30:15 caiu",
  "timeout na exportação de 2026-11-10",
];
for (const texto of naoCasam) afirmar(sensivel(texto) === null, `não casa: ${texto.slice(0, 50)}`);
afirmar([...naoCasam[0]].length === 800, "o resumo de 800 pontos de código com emoji tem 800");

// --- R2 estático ---
console.log("R2: estático");
const fonte = readFileSync(join(root, "skills", "gm-triage", "jev-triagem.mjs"), "utf8");
for (const proibido of ["child_process", "node:http", "node:https", "node:net", "node:tls", "fetch("]) {
  afirmar(!fonte.includes(proibido), `jev-triagem.mjs não contém ${proibido}`);
}

console.log(falhas === 0 ? "\ntudo certo" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);

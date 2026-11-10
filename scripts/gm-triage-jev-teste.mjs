#!/usr/bin/env node
// Testa skills/gm-triage/jev-triagem.mjs (card #41), sem rede e sem chave.
// Uso: node scripts/gm-triage-jev-teste.mjs     sai 0 se todos os casos passam, 1 se algum falha.
//
// Antes de qualquer caso o env perde as variáveis do Jev e o fetch passa a lançar: este script nunca
// pode falar com a TypeSafe AI nem herdar a chave. O estado "ligado" vem só do falso (BRAIN_JEV_FALSO).
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

const { USO, CAMPOS, LIMIAR_PCT, PRAZO_MS, FOLGA_MS, MAX_RESUMO, INSTRUCOES, DESCRICOES, normalizar, lerBoard, sensivel, sugerir, renderizar, principal } =
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

// --- cliente falso em processo (molde de brain-mcp/scripts/embeddings-falso.mjs) ---
// Tem a forma do contrato e registra o uso de `ligado` e cada chamada de `decidir`.
function criarFalso({ ligado = true, decidir }) {
  const f = { usosLigado: [], chamadas: [] };
  f.ligado = (uso) => {
    f.usosLigado.push(uso);
    if (typeof ligado === "function") return ligado(uso);
    return ligado;
  };
  f.decidir = (estado, perguntas, opcoes) => {
    f.chamadas.push({ estado, perguntas, opcoes });
    return decidir(estado, perguntas, opcoes);
  };
  return f;
}
const ok = (escolha, probabilidades) => ({ estado: "ok", tipo: "escolha", escolha, confianca: probabilidades[escolha], probabilidades });
// Resposta ok que dá a `escolha` a probabilidade `p` e reparte o resto igual (o contrato faz o mesmo).
function respostaPara(perguntas, roteiro) {
  const saida = {};
  for (const [campo, pergunta] of Object.entries(perguntas)) {
    const nomes = Object.keys(pergunta.opcoes);
    const [escolha, p, extras = {}] = roteiro[campo] ?? [nomes[0], 0.95];
    const probs = Object.fromEntries(nomes.map((n) => [n, n === escolha ? p : (extras[n] ?? (1 - p) / (nomes.length - 1))]));
    saida[campo] = ok(escolha, probs);
  }
  return saida;
}
const ROTEIRO_PRINCIPAL = {
  Tipo: ["✨ Melhoria", 0.82],
  Severidade: ["S2", 0.75, { S3: 0.2, S1: 0.05 }],
  Classe: ["⚪ Padrão", 0.9],
  Rota: ["Curta", 0.71],
  "Módulo": ["skills", 0.64],
};
const PROPOSTA = { Tipo: "✨ Melhoria", Severidade: "S3", Classe: "⚪ Padrão", Rota: null, "Módulo": "skills" };
const RESUMO = "o filtro de contexto devolve resultado velho depois de reindexar";
const falsoPadrao = (roteiro = ROTEIRO_PRINCIPAL) => criarFalso({ decidir: (_e, perguntas) => respostaPara(perguntas, roteiro) });
const rodar = (cliente, extra = {}) =>
  sugerir({ opcoes: board, entrada: { resumo: RESUMO, proposta: PROPOSTA }, cliente, ...extra });
const motivo = (r) => (r.estado === "falhou" ? r.motivo : `(${r.estado})`);

// --- R1: sugerir desligado ---
console.log("R1: sugerir desligado");
for (const [nome, cliente] of [
  ["cliente nulo", null],
  ["ligado falso", criarFalso({ ligado: false, decidir: () => ({}) })],
  [
    "ligado lança",
    criarFalso({
      ligado: () => {
        throw new Error("x");
      },
      decidir: () => ({}),
    }),
  ],
]) {
  const r = await rodar(cliente);
  afirmar(r.estado === "desligado", `${nome} → desligado`);
  afirmar(cliente === null || cliente.chamadas.length === 0, `${nome}: nenhum decidir`);
  afirmar(renderizar(r) === "", `${nome}: renderizar → ""`);
}

// --- R2: caso principal ---
console.log("R2: caso principal");
const CABECALHO_ESPERADO =
  "**Sugestão do Jev** — só leitura, nada disto é gravado. `⚠ revisar` = o Jev dá menos de 70% ao valor proposto.\n\n" +
  "| Campo | Proposta da sessão | Jev nela | Escolha do Jev | |\n" +
  "|---|---|---|---|---|\n";
const ESPERADO_PRINCIPAL =
  CABECALHO_ESPERADO +
  [
    "| Tipo | ✨ Melhoria | 82% | = | |",
    "| Severidade | S3 | 20% | S2 (75%) | ⚠ revisar |",
    "| Classe | ⚪ Padrão | 90% | = | |",
    "| Rota | — | — | Curta (71%) | |",
    "| Módulo | skills | 64% | = | ⚠ revisar |",
  ].join("\n");
{
  const f = falsoPadrao();
  const r = await rodar(f);
  afirmar(igual(f.usosLigado, ["triagem"]), "ligado chamado com triagem");
  afirmar(f.chamadas.length === 1, "um só decidir");
  const c = f.chamadas[0];
  afirmar(c.estado === RESUMO, "o resumo é o estado");
  afirmar(igual(c.opcoes, { uso: "triagem", timeoutMs: 10000 }), "opcoes = { uso, timeoutMs }");
  afirmar(igual(Object.keys(c.perguntas), CAMPOS), "cinco perguntas, na ordem de CAMPOS");
  afirmar(Object.values(c.perguntas).every((p) => p.tipo === "escolha"), "todas do tipo escolha");
  afirmar(CAMPOS.every((campo) => igual(Object.keys(c.perguntas[campo].opcoes), board.get(campo))), "R3: opcoes das perguntas = lerBoard, campo a campo");
  afirmar(c.perguntas.Tipo.opcoes["🐞 Bug"] === DESCRICOES.Tipo.Bug && c.perguntas["Módulo"].opcoes.skills === "skills", "descrições: do mapa, e o Módulo com o próprio rótulo");
  afirmar(r.estado === "ligado" && typeof r.ms === "number", "estado ligado, com ms");
  afirmar(renderizar(r) === ESPERADO_PRINCIPAL, "markdown igual byte a byte ao exemplo");
}

// --- R2: arredondamento e limiar ---
console.log("R2: arredondamento e limiar");
async function pctDaProposta(p) {
  const f = criarFalso({
    decidir: (_e, perguntas) => ({
      Tipo: ok("🐞 Bug", { "🐞 Bug": 1 - p, "❓ Dúvida": 0, "✨ Melhoria": p, "🧰 Débito técnico": 0 }),
    }),
  });
  // só o Tipo é perguntado: os outros campos ficam sem linha no ## Board da fixture
  const mapa = new Map([["Tipo", board.get("Tipo")]]);
  const r = await sugerir({ opcoes: mapa, entrada: { resumo: RESUMO, proposta: { Tipo: "✨ Melhoria" } }, cliente: f });
  return r.campos[0];
}
for (const [p, esperado, marca] of [[0.7, 70, false], [0.6999, 69, true], [0.29, 29, true], [0.57, 57, true]]) {
  const c = await pctDaProposta(p);
  afirmar(c.pProposta === esperado && c.revisar === marca, `${p} → ${esperado}%${marca ? " com marca" : " sem marca"}`);
}

// --- R2: uma opção só, campo ausente, proposta fora, sem emoji ---
console.log("R2: casos de campo");
{
  const mapa = new Map(board);
  mapa.set("Módulo", ["Comum"]);
  const f = falsoPadrao();
  const r = await sugerir({ opcoes: mapa, entrada: { resumo: RESUMO, proposta: { ...PROPOSTA, "Módulo": "Comum" } }, cliente: f });
  afirmar(!("Módulo" in f.chamadas[0].perguntas), "uma opção só: Módulo fora das perguntas");
  afirmar(renderizar(r).split("\n").includes("| Módulo | Comum | 100% (única opção) | = | |"), "uma opção só: linha com a proposta");
  const f2 = falsoPadrao();
  const r2 = await sugerir({ opcoes: mapa, entrada: { resumo: RESUMO, proposta: { ...PROPOSTA, "Módulo": null } }, cliente: f2 });
  afirmar(renderizar(r2).split("\n").includes("| Módulo | — | — | Comum (100%) | |"), "uma opção só: linha sem proposta");
  const f3 = falsoPadrao();
  const r3 = await sugerir({ opcoes: mapa, entrada: { resumo: RESUMO, proposta: { ...PROPOSTA, "Módulo": "Outro" } }, cliente: f3 });
  const c3 = r3.campos.find((c) => c.campo === "Módulo");
  afirmar(c3.revisar === true && c3.pProposta === null && c3.nota === "proposta fora do ## Board", "uma opção só, proposta diferente: fora do Board e revisar");
}
{
  const mapa = new Map(board);
  mapa.delete("Rota");
  const f = falsoPadrao();
  const r = await sugerir({ opcoes: mapa, entrada: { resumo: RESUMO, proposta: PROPOSTA }, cliente: f });
  afirmar(!("Rota" in f.chamadas[0].perguntas), "campo ausente do Board: fora das perguntas");
  afirmar(renderizar(r).split("\n").includes("| Rota | — | — | — | não declarado no `## Board` |"), "campo ausente do Board: linha");
}
{
  const f = criarFalso({ decidir: (_e, perguntas) => respostaPara(perguntas, ROTEIRO_PRINCIPAL) });
  const r = await rodar(f, { entrada: { resumo: RESUMO, proposta: { ...PROPOSTA, "Módulo": "Processos" } } });
  afirmar(
    renderizar(r).split("\n").includes("| Módulo | Processos | — | skills (64%) | ⚠ revisar (proposta fora do `## Board`) |"),
    "proposta fora do Board: linha",
  );
  const f2 = falsoPadrao();
  const r2 = await rodar(f2, { entrada: { resumo: RESUMO, proposta: { ...PROPOSTA, Tipo: "Melhoria", Classe: "⚪️ Padrão" } } });
  const t = r2.campos.find((c) => c.campo === "Tipo");
  const cl = r2.campos.find((c) => c.campo === "Classe");
  afirmar(t.proposta === "✨ Melhoria" && t.pProposta === 82, "proposta sem emoji casa com o rótulo");
  afirmar(cl.proposta === "⚪ Padrão" && cl.pProposta === 90, "proposta com U+FE0F casa com o rótulo");
}

// --- R2: falhas do Jev ---
console.log("R2: falhas");
{
  const f = criarFalso({
    decidir: (_e, perguntas) => Object.fromEntries(Object.keys(perguntas).map((c) => [c, { estado: "indisponivel", motivo: "http", detalhe: "429" }])),
  });
  const r = await rodar(f);
  afirmar(r.estado === "falhou" && typeof r.ms === "number", "indisponível → falhou, com ms");
  afirmar(
    renderizar(r) === "Sem a sugestão do Jev: o Jev ficou indisponível (http: 429). A classificação acima é só a da sessão.",
    "indisponível: mensagem",
  );
}
{
  const f = criarFalso({ decidir: () => new Promise(() => {}) });
  const t0 = Date.now();
  const r = await rodar(f, { prazoMs: 50, folgaMs: 30 });
  afirmar(r.estado === "falhou" && r.motivo === "o Jev não respondeu em 0,05 s", `decidir que não resolve: ${motivo(r)}`);
  afirmar(Date.now() - t0 < 500, "volta em menos de 500 ms");
}
{
  const base = (perguntas) => respostaPara(perguntas, ROTEIRO_PRINCIPAL);
  const mistura1 = criarFalso({
    decidir: (_e, p) => ({ ...base(p), Tipo: { ...base(p).Tipo, escolha: "inexistente" }, Severidade: { estado: "indisponivel", motivo: "http" } }),
  });
  afirmar(motivo(await rodar(mistura1)) === "resposta inválida do Jev no campo Tipo", "Tipo inválido antes de Severidade indisponível → inválida no Tipo");
  const mistura2 = criarFalso({
    decidir: (_e, p) => ({ ...base(p), Tipo: { estado: "indisponivel", motivo: "http" }, Severidade: { ...base(p).Severidade, escolha: "S9" } }),
  });
  afirmar(motivo(await rodar(mistura2)).startsWith("o Jev ficou indisponível ("), "Tipo indisponível antes de Severidade inválida → indisponível");
}
{
  const lanca = (v) => criarFalso({ decidir: () => { throw v; } });
  afirmar(motivo(await rodar(lanca(new Error("x\ny")))) === "o cliente do Jev falhou: x", "decidir que lança: primeira linha");
  afirmar(motivo(await rodar(lanca("texto solto"))) === "o cliente do Jev falhou: texto solto", "decidir que lança uma string");
  const rej = criarFalso({ decidir: () => Promise.reject(new Error("rejeitou")) });
  afirmar(motivo(await rodar(rej)) === "o cliente do Jev falhou: rejeitou", "decidir que rejeita");
}
{
  const base = (perguntas) => respostaPara(perguntas, ROTEIRO_PRINCIPAL);
  const casos = [
    ["escolha fora das opções", (p) => ({ ...base(p), Classe: { ...base(p).Classe, escolha: "Outra" } }), "Classe"],
    ["chave faltando", (p) => { const b = base(p); delete b.Rota; return b; }, "Rota"],
    ["probabilidades ausente", (p) => ({ ...base(p), Severidade: { estado: "ok", tipo: "escolha", escolha: "S2" } }), "Severidade"],
    ["probabilidades[proposta] = 1,5", (p) => ({ ...base(p), Tipo: { ...base(p).Tipo, probabilidades: { ...base(p).Tipo.probabilidades, "✨ Melhoria": 1.5 } } }), "Tipo"],
    ["resultado null", () => null, "Tipo"],
    ["resultado {}", () => ({}), "Tipo"],
    ["resultado que não é objeto", () => "x", "Tipo"],
    ["estado diferente de ok", (p) => ({ ...base(p), Rota: { ...base(p).Rota, estado: "desligado" } }), "Rota"],
  ];
  for (const [nome, fn, campo] of casos) {
    const r = await rodar(criarFalso({ decidir: (_e, p) => fn(p) }));
    afirmar(r.estado === "falhou" && r.motivo === `resposta inválida do Jev no campo ${campo}`, `${nome} → ${motivo(r)}`);
  }
}

// --- R2: resumo e sensivel dentro de sugerir ---
console.log("R2: resumo e guarda");
{
  const tenta = async (resumo) => {
    const f = falsoPadrao();
    const r = await sugerir({ opcoes: board, entrada: { resumo, proposta: PROPOSTA }, cliente: f });
    return { r, f };
  };
  let t = await tenta("   ");
  afirmar(t.r.estado === "falhou" && t.r.motivo === "o resumo para o Jev veio vazio" && t.f.chamadas.length === 0, "resumo vazio: falhou, sem decidir");
  t = await tenta("x".repeat(801));
  afirmar(t.r.estado === "falhou" && t.r.motivo === "o resumo para o Jev passou de 800 caracteres" && t.f.chamadas.length === 0, "801 pontos de código: falhou, sem decidir");
  t = await tenta("😀".repeat(801));
  afirmar(t.r.estado === "falhou" && t.f.chamadas.length === 0, "801 emojis: falhou, sem decidir");
  for (const [texto, padrao] of casam) {
    t = await tenta(texto);
    afirmar(t.r.estado === "falhou" && t.r.motivo === `o resumo parece ter ${padrao}; nada foi enviado` && t.f.chamadas.length === 0, `falhou sem decidir: ${padrao}: ${texto}`);
  }
  for (const texto of naoCasam) {
    t = await tenta(texto);
    afirmar(t.r.estado === "ligado" && t.f.chamadas.length === 1, `passa: ${texto.slice(0, 50)}`);
  }
}

// --- principal, com carregar, stdout e stderr injetados ---
console.log("principal");
{
  const tmp = mkdtempSync(join(tmpdir(), "jev-triagem-teste-"));
  try {
    const captura = () => {
      const c = { out: "", err: "" };
      c.stdout = { write: (x) => void (c.out += x) };
      c.stderr = { write: (x) => void (c.err += x) };
      return c;
    };
    const arquivos = (entrada = JSON.stringify({ resumo: RESUMO, proposta: PROPOSTA })) => {
      const e = join(tmp, "entrada.json");
      const m = join(tmp, "CLAUDE.md");
      writeFileSync(e, entrada);
      writeFileSync(m, claudeMd);
      return { e, m };
    };
    const rodarP = async (argv, carregar) => {
      const c = captura();
      const codigo = await principal(argv, { carregar, stdout: c.stdout, stderr: c.stderr });
      return { ...c, codigo };
    };
    const nunca = () => {
      throw new Error("carregar não devia ser chamado");
    };

    // R1: --estado com cliente indisponível
    let r = await rodarP(["--estado"], () => ({ cliente: null, motivo: "jev.js não instalado" }));
    afirmar(r.out === "" && r.codigo === 0 && r.err === "jev-triagem: cliente indisponível: jev.js não instalado\n", "--estado indisponível: stdout vazio, diagnóstico no stderr, código 0");
    const desl = criarFalso({ ligado: false, decidir: () => ({}) });
    r = await rodarP(["--estado"], () => ({ cliente: desl, motivo: null }));
    afirmar(r.out === "" && r.codigo === 0 && r.err === "jev-triagem: cliente carregado, desligado\n", "--estado desligado");
    const quebra = criarFalso({ ligado: () => { throw new Error("x"); }, decidir: () => ({}) });
    r = await rodarP(["--estado"], () => ({ cliente: quebra, motivo: null }));
    afirmar(r.out === "" && r.codigo === 0, "--estado com ligado que lança → desligado");
    r = await rodarP(["--estado"], () => ({ cliente: falsoPadrao(), motivo: null }));
    afirmar(r.out === "ligado\n" && r.codigo === 0 && r.err === "", "--estado ligado → stdout exatamente ligado");

    // validação do argv
    for (const argv of [[], ["--entrada", "a"], ["--claude-md", "a"], ["--estado", "x"], ["--claude-md", "a", "--entrada", "b", "c"], ["--claude-md", "a", "--claude-md", "b"], ["--x"], ["--claude-md", "a", "--outro", "b"]]) {
      r = await rodarP(argv, nunca);
      afirmar(r.codigo === 2 && r.out === "" && r.err.startsWith("uso:"), `argv inválido → código 2 sem carregar: ${JSON.stringify(argv)}`);
    }

    // R1: modo completo desligado apaga a entrada sem ler e não chama decidir
    let { e, m } = arquivos("conteúdo que não pode ser lido");
    const espia = criarFalso({ ligado: false, decidir: () => ({}) });
    r = await rodarP(["--claude-md", m, "--entrada", e], () => ({ cliente: espia, motivo: null }));
    afirmar(r.out === "" && r.codigo === 0 && r.err === "jev-triagem: cliente carregado, desligado\n" && !existsSync(e) && espia.chamadas.length === 0 && existsSync(m), "modo completo desligado: entrada apagada, sem decidir, CLAUDE.md intacto");
    ({ e, m } = arquivos());
    r = await rodarP(["--claude-md", m, "--entrada", e], () => ({ cliente: null, motivo: "quebrado" }));
    afirmar(r.out === "" && r.codigo === 0 && !existsSync(e) && r.err.includes("quebrado"), "modo completo sem cliente: entrada apagada");

    // R2: JSON inválido
    ({ e, m } = arquivos("{não é json"));
    let f = falsoPadrao();
    r = await rodarP(["--claude-md", m, "--entrada", e], () => ({ cliente: f, motivo: null }));
    afirmar(r.out === "Sem a sugestão do Jev: não consegui ler entrada.json. A classificação acima é só a da sessão.\n" && r.codigo === 0 && !existsSync(e) && f.chamadas.length === 0 && r.err === "", "entrada com JSON inválido: mensagem, entrada apagada, sem decidir, sem linha de ms");
    // R2: entrada ausente
    rmSync(e, { force: true });
    r = await rodarP(["--claude-md", m, "--entrada", e], () => ({ cliente: f, motivo: null }));
    afirmar(r.out.startsWith("Sem a sugestão do Jev: não consegui ler entrada.json") && r.codigo === 0, "entrada inexistente: não consegui ler");

    // R3: CLAUDE.md sem ## Board, e ilegível
    ({ e, m } = arquivos());
    writeFileSync(m, "# nada aqui\n");
    r = await rodarP(["--claude-md", m, "--entrada", e], () => ({ cliente: f, motivo: null }));
    afirmar(r.out === "Sem a sugestão do Jev: não achei o ## Board em CLAUDE.md. A classificação acima é só a da sessão.\n" && !existsSync(e) && f.chamadas.length === 0 && r.err === "", "CLAUDE.md sem ## Board");
    ({ e, m } = arquivos());
    r = await rodarP(["--claude-md", join(tmp, "nao-existe.md"), "--entrada", e], () => ({ cliente: f, motivo: null }));
    afirmar(r.out.startsWith("Sem a sugestão do Jev: não consegui ler nao-existe.md") && !existsSync(e), "CLAUDE.md ilegível: entrada apagada mesmo assim");

    // modo completo ligado, com o falso em processo
    ({ e, m } = arquivos());
    f = falsoPadrao();
    r = await rodarP(["--entrada", e, "--claude-md", m], () => ({ cliente: f, motivo: null }));
    const esperado = renderizar(await rodar(falsoPadrao()));
    afirmar(r.out === esperado + "\n" && r.out.endsWith("|\n") && r.codigo === 0, "modo completo ligado: markdown no stdout com \\n final");
    afirmar(/^jev-triagem: \d+ ms\n$/.test(r.err) && !existsSync(e) && f.chamadas.length === 1, "modo completo ligado: ms no stderr, entrada apagada, uma chamada");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// --- R2 estático ---
console.log("R2: estático");
const fonte = readFileSync(join(root, "skills", "gm-triage", "jev-triagem.mjs"), "utf8");
for (const proibido of ["child_process", "node:http", "node:https", "node:net", "node:tls", "fetch("]) {
  afirmar(!fonte.includes(proibido), `jev-triagem.mjs não contém ${proibido}`);
}

console.log(falhas === 0 ? "\ntudo certo" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);

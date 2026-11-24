// Teste do agregador `painel.mjs`, do leitor `painel/eventos.mjs` e da secao `painel/saude.mjs`
// (claude-brain#66, F1, CA1), sobre fixtures em scripts/fixtures/telemetria/saude/. Sem rede, sem
// indice, sem tocar o diario vivo: o `env` de cada chamada e explicito.
//
//   node scripts/painel-teste.mjs        sai 0 se tudo passou, 1 se alguma verificacao falhou
//
// Os numeros esperados sao os da fixture CONTADOS A MAO (o percentil e o de uso.mjs: indice
// floor(p * (n - 1)) no vetor ordenado), e nao recalculados pelo mesmo codigo que se testa.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rodar } from "./painel.mjs";
import { dirPadrao, lerEventos } from "./painel/eventos.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(aqui, "fixtures", "telemetria", "saude");
const SECOES_REAIS = join(aqui, "painel");
const falhas = [];
let verificacoes = 0;
const confere = (cond, msg) => {
  verificacoes++;
  if (!cond) falhas.push(msg);
};
const igual = (real, esperado, msg) => confere(JSON.stringify(real) === JSON.stringify(esperado), `${msg}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(real)}`);

const tmp = mkdtempSync(join(tmpdir(), "painel-teste-"));
try {
  const envFixture = { BRAIN_TELEMETRIA_DIR: FIXTURE, BRAIN_DB: join(tmp, "nao-existe.db"), CLAUDE_CONFIG_DIR: join(tmp, "casa") };
  const PERIODO = ["--desde", "2026-11-20", "--ate", "2026-11-21"];
  const novaPasta = (nome, secoes = {}) => {
    const pasta = join(tmp, nome);
    mkdirSync(pasta, { recursive: true });
    for (const [arquivo, conteudo] of Object.entries(secoes)) {
      if (conteudo === null) copyFileSync(join(SECOES_REAIS, arquivo), join(pasta, arquivo));
      else writeFileSync(join(pasta, arquivo), conteudo);
    }
    return pasta;
  };

  // ---- leitor: periodo, invalidas, outra versao, ordem ----------------------------------------
  {
    const dia = (d) => Date.parse(`${d}T00:00:00Z`);
    const dois = lerEventos({ dir: FIXTURE, desde: dia("2026-11-20"), ate: dia("2026-11-22") });
    igual([dois.eventos.length, dois.invalidas, dois.outraVersao, dois.arquivos], [23, 1, 1, 2], "leitor: dois dias (17 contexto + 6 jev), 1 invalida, 1 v:2");
    confere(dois.eventos.every((e, i, v) => i === 0 || v[i - 1].ts <= e.ts), "leitor: em ordem de ts");
    igual(lerEventos({ dir: FIXTURE, desde: dia("2026-11-22"), ate: dia("2026-11-23") }).eventos.length, 1, "leitor: so o dia 22");
    igual(lerEventos({ dir: FIXTURE, desde: dia("2026-11-23"), ate: dia("2026-11-30") }).eventos.length, 0, "leitor: periodo sem arquivo");
    // `ate` e exclusivo: [20 12:00:00, 20 12:00:03) so tem os 3 primeiros eventos
    const meio = lerEventos({ dir: FIXTURE, desde: Date.UTC(2026, 10, 20, 12, 0, 0), ate: Date.UTC(2026, 10, 20, 12, 0, 3) });
    igual(meio.eventos.length, 3, "leitor: [desde, ate) exclusivo no fim");
    igual(lerEventos({ dir: join(tmp, "nao-existe"), desde: 0, ate: 1 }), { eventos: [], invalidas: 0, outraVersao: 0, arquivos: 0 }, "leitor: diretorio ausente");
    igual(dirPadrao({ BRAIN_TELEMETRIA_DIR: "/x/y" }), "/x/y", "dirPadrao: BRAIN_TELEMETRIA_DIR");
    igual(dirPadrao({ CLAUDE_CONFIG_DIR: "/c" }).replace(/\\/g, "/"), "/c/brain-telemetria", "dirPadrao: <CLAUDE_HOME>/brain-telemetria");
  }

  // ---- saude: os numeros esperados da fixture (CA1) -------------------------------------------
  {
    const saude = await import(pathToFileURL(join(SECOES_REAIS, "saude.mjs")).href);
    const { eventos } = lerEventos({ dir: FIXTURE, desde: Date.parse("2026-11-20T00:00:00Z"), ate: Date.parse("2026-11-22T00:00:00Z") });
    const texto = await saude.secao({ eventos });
    const tem = (re, msg) => confere(re.test(texto), `saude: ${msg}\n${texto}`);
    tem(/Hook de contexto: 17 execuções/, "17 execucoes do hook");
    tem(/injetado\s+7\s+41\.2%/, "injetado 7 de 17 = 41.2%");
    tem(/curto\s+2\s+11\.8%/, "curto 2 = 11.8%");
    for (const d of ["entidade", "jev_reprovou_tudo", "sem_candidatos", "sem_enviaveis", "ignorado", "sem_indice", "sem_payload", "erro"]) tem(new RegExp(`${d}\\s+1\\s+5\\.9%`), `${d} 1 = 5.9%`);
    tem(/desfechos que buscaram: p50 560 ms · p90 900 ms \(n=11\)/, "ms_total dos que buscaram: 11 valores, p50 560, p90 900");
    tem(/todos:\s+p50 120 ms · p90 800 ms \(n=17\)\s+\(sem a partida do node\)/, "ms_total de todos: 17 valores, p50 120, p90 800, com a nota do node");
    tem(/ms_busca: p50 98 ms · p90 105 ms \(n=10\)/, "ms_busca: 10 valores");
    tem(/ms_jev:\s+p50 500 ms · p90 700 ms \(n=7\)/, "ms_jev: 7 valores");
    tem(/\bok\s+3\b/, "jev ok 3");
    tem(/indisponivel\s+2\s+motivo rede: 1\s+motivo timeout: 1/, "jev indisponivel 2, motivos rede e timeout");
    tem(/prazo_hook\s+1/, "jev prazo_hook 1");
    tem(/desligado\s+1/, "jev desligado 1");
    tem(/sem_filtro_ab\s+1/, "jev sem_filtro_ab 1");
    tem(/\(sem chamada\)\s+8/, "8 sem chamada ao Jev");
    tem(/reprovou todos os trechos: 1 de 3 chamadas ok = 33\.3%/, "reprovou tudo: 1 de 3 = 33.3%");
    tem(/com_filtro 3 · sem_filtro 1/, "A/B: 3 e 1 prompts sorteados");
    tem(/Jev, todo uso: 6 chamadas/, "6 chamadas do Jev");
    tem(/contexto: 3 chamadas · 20 itens · p50 400 ms · p90 400 ms \(n=3\) · indisponíveis 5\s+motivos: timeout 5/, "uso contexto");
    tem(/triagem: 2 chamadas · 3 itens · p50 0 ms · p90 0 ms \(n=2\) · indisponíveis 1\s+motivos: sem_chave 1/, "uso triagem");
    tem(/\(fora da tabela\): 1 chamadas · 2 itens .* indisponíveis 2\s+motivos: entrada_invalida 2/, "uso fora da tabela");
    tem(/por cliente: api 3 · falso 1 · sem_chave 1 · invalida 1/, "por cliente");
    tem(/tokens somados: input_tokens 150 · output_tokens 30/, "tokens somados");
    // sem `usage` no periodo: a frase
    const semTokens = await saude.secao({ eventos: eventos.filter((e) => e.evento === "jev").map((e) => ({ ...e, tokens: null })) });
    confere(semTokens.includes("a API não devolveu uso de tokens no período"), "saude: sem tokens, a frase");
    // lista vazia nao quebra
    confere((await saude.secao({ eventos: [] })).includes("0 execuções"), "saude: sem evento nao quebra");
    // nome adulterado no arquivo nao vaza: so lista fechada
    const adulterado = await saude.secao({ eventos: [{ evento: "contexto", desfecho: "/home/leo/segredo", jev: "texto livre", ms_total: 1 }, { evento: "jev", uso: "/etc/passwd", cliente: "x", motivos: { "texto do prompt": 1 }, itens: 1, ms: 1, tokens: { "/caminho": 3 } }] });
    confere(!/segredo|texto livre|passwd|texto do prompt|caminho/.test(adulterado), "saude: valor fora da lista fechada nao aparece na saida");
    // R1: nenhum caminho da fixture
    confere(!texto.includes("/w/") && !texto.includes(".md"), "saude: a saida nao traz caminho da fixture");
  }

  // ---- agregador: cabecalho, secoes ausentes, ordem ------------------------------------------
  {
    const soSaude = novaPasta("so-saude", { "saude.mjs": null });
    const r = await rodar({ argv: PERIODO, secoesDir: soSaude, env: envFixture });
    igual(r.codigo, 0, "rodar: so a saude, codigo 0");
    confere(r.saida.startsWith("Telemetria, 2026-11-20 a 2026-11-21 (UTC)\n  eventos: contexto 17 · jev 6\n  linhas inválidas: 1 · de outra versão (ignoradas): 1"), `rodar: cabecalho\n${r.saida.slice(0, 200)}`);
    confere(r.saida.includes("(ganho: seção não instalada)") && r.saida.includes("(prova: seção não instalada)"), "rodar: as outras secoes viram 'nao instalada'");
    confere(r.saida.indexOf("Saúde e custo") < r.saida.indexOf("(ganho:") && r.saida.indexOf("(ganho:") < r.saida.indexOf("(prova:"), "rodar: ordem saude, ganho, prova");
    confere(!r.saida.includes("/w/") && !r.saida.includes(FIXTURE), "rodar: a saida nao traz caminho da fixture");

    // ate inclui o dia inteiro: --ate 2026-11-22 soma o evento do dia 22
    const tres = await rodar({ argv: ["--desde", "2026-11-20", "--ate", "2026-11-22"], secoesDir: soSaude, env: envFixture });
    confere(tres.saida.includes("contexto 18 · jev 6") && tres.saida.includes("Hook de contexto: 18 execuções"), "rodar: --ate inclui o dia inteiro");

    // secao de teste que lanca -> codigo 1, mensagem so com o nome do erro
    const comFalha = novaPasta("com-falha", { "saude.mjs": null, "ganho.mjs": 'export async function secao() { const e = new TypeError("detalhe secreto /home/x"); throw e; }\n' });
    const f = await rodar({ argv: PERIODO, secoesDir: comFalha, env: envFixture });
    igual(f.codigo, 1, "rodar: secao que lanca, codigo 1");
    confere(f.saida.includes("(ganho: falhou — TypeError)") && !f.saida.includes("secreto") && f.saida.includes("(prova: seção não instalada)") && f.saida.includes("Saúde e custo"), "rodar: a falha so diz o nome do erro e as outras secoes seguem");

    // secao com erro de sintaxe: falhou, nao 'nao instalada'
    const quebrada = novaPasta("quebrada", { "saude.mjs": null, "prova.mjs": "export async function secao( {\n" });
    const q = await rodar({ argv: PERIODO, secoesDir: quebrada, env: envFixture });
    confere(q.codigo === 1 && q.saida.includes("(prova: falhou — SyntaxError)"), "rodar: secao com erro de sintaxe e falha, nao 'nao instalada'");

    // secoesDir como URL, e as secoes de teste entram na ordem e recebem o ctx do contrato
    const sonda = novaPasta("sonda", {
      "saude.mjs": 'export async function secao() { return "SAUDE"; }\n',
      "ganho.mjs": `export async function secao(ctx) {
        const c = await ctx.carregarSecao("saude"); const nada = await ctx.carregarSecao("nao-existe");
        const doDia = ctx.lerEventos({ desde: Date.parse("2026-11-22T00:00:00Z"), ate: Date.parse("2026-11-23T00:00:00Z") });
        return JSON.stringify({ chaves: Object.keys(ctx).sort(), nEventos: ctx.eventos.length, invalidas: ctx.invalidas, outraVersao: ctx.outraVersao,
          periodoOk: ctx.desde < ctx.ate && ctx.ate <= ctx.agora + 1, dirOk: typeof ctx.dir === "string", db: ctx.db,
          projetos: ctx.projetos.replace(/\\\\/g, "/").endsWith("/casa/projects"), claudeHome: ctx.claudeHome.replace(/\\\\/g, "/").endsWith("/casa"),
          argsDias: ctx.args.dias, saudeOk: typeof c.secao === "function", nada, doDia: doDia.eventos.length });
      }\n`,
      "prova.mjs": 'export async function secao() { return "PROVA"; }\n',
    });
    const s = await rodar({ argv: ["--dias", "100000"], secoesDir: pathToFileURL(sonda + "/"), env: envFixture });
    const ganho = JSON.parse(s.saida.split("\n").find((l) => l.startsWith("{")));
    igual(ganho.chaves, ["agora", "args", "ate", "carregarSecao", "claudeHome", "db", "desde", "dir", "eventos", "invalidas", "lerEventos", "outraVersao", "projetos"].sort(), "ctx: as chaves do contrato");
    confere(s.saida.includes("SAUDE") && s.saida.includes("PROVA") && s.saida.indexOf("SAUDE") < s.saida.indexOf('{"chaves"') && s.saida.indexOf('{"chaves"') < s.saida.indexOf("PROVA"), "rodar: secoesDir como URL, ordem saude, ganho, prova");
    igual([ganho.nEventos, ganho.invalidas, ganho.outraVersao, ganho.periodoOk, ganho.dirOk, ganho.db, ganho.projetos, ganho.claudeHome, ganho.argsDias, ganho.saudeOk, ganho.nada, ganho.doDia], [24, 1, 1, true, true, null, true, true, 100000, true, null, 1], "ctx: valores (db null sem banco, lerEventos com outro periodo, carregarSecao nulo para a ausente)");
  }

  // ---- --amostrar e --julgar entregues a F3 ---------------------------------------------------
  {
    const registro = join(tmp, "chamadas.json");
    const prova = novaPasta("com-prova", {
      "prova.mjs": `import { writeFileSync } from "node:fs";
        export async function secao() { return "nao deve rodar"; }
        export async function amostrar(ctx, n, semente) { writeFileSync(${JSON.stringify(registro)}, JSON.stringify({ via: "amostrar", n, semente, ws: ctx.args.ws, temEventos: Array.isArray(ctx.eventos) })); return { codigo: 0, linhas: ["amostra-x.jsonl", "30 itens"] }; }
        export async function julgar(ctx, arquivo) { writeFileSync(${JSON.stringify(registro)}, JSON.stringify({ via: "julgar", arquivo })); return { codigo: 2, linhas: ["precisa de terminal"] }; }\n`,
    });
    const vazio = { ...envFixture, BRAIN_TELEMETRIA_DIR: join(tmp, "diario-vazio") };
    const a = await rodar({ argv: ["--amostrar", "30", "--semente", "abc", "--ws", "pessoal"], secoesDir: prova, env: vazio });
    igual([a.codigo, a.saida], [0, "amostra-x.jsonl\n30 itens"], "amostrar: codigo e linhas da secao prova; nao passa pela regra de periodo vazio");
    igual(JSON.parse((await import("node:fs")).readFileSync(registro, "utf8")), { via: "amostrar", n: 30, semente: "abc", ws: "pessoal", temEventos: true }, "amostrar: n, semente e --ws chegam a prova");
    const j = await rodar({ argv: ["--julgar", "amostra-x.jsonl"], secoesDir: prova, env: vazio });
    igual([j.codigo, j.saida], [2, "precisa de terminal"], "julgar: o codigo da prova vale");
    igual(JSON.parse((await import("node:fs")).readFileSync(registro, "utf8")), { via: "julgar", arquivo: "amostra-x.jsonl" }, "julgar: o arquivo chega a prova");
    const sem = await rodar({ argv: ["--amostrar", "5"], secoesDir: novaPasta("sem-prova"), env: envFixture });
    igual([sem.codigo, sem.saida], [2, "seção prova não instalada"], "amostrar sem prova.mjs: codigo 2");
    const semJulgar = await rodar({ argv: ["--julgar", "x"], secoesDir: novaPasta("sem-prova-2"), env: envFixture });
    igual(semJulgar.codigo, 2, "julgar sem prova.mjs: codigo 2");
    const falha = novaPasta("prova-falha", { "prova.mjs": 'export async function amostrar() { throw new RangeError("x"); }\n' });
    const ff = await rodar({ argv: ["--amostrar", "5"], secoesDir: falha, env: envFixture });
    igual([ff.codigo, ff.saida], [1, "(prova: falhou — RangeError)"], "amostrar que lanca: codigo 1");
  }

  // ---- periodo vazio, diretorio ausente, argumentos -------------------------------------------
  {
    const pasta = novaPasta("vazios", { "saude.mjs": null });
    const naoExiste = join(tmp, "diario-que-nao-existe");
    const a = await rodar({ argv: ["--dias", "1"], secoesDir: pasta, env: { ...envFixture, BRAIN_TELEMETRIA_DIR: naoExiste } });
    confere(a.codigo === 2 && a.saida.includes("BRAIN_TELEMETRIA=1") && a.saida.includes("não existe"), "diretorio ausente: codigo 2 e o lembrete");
    confere(!existsSync(naoExiste), "diretorio ausente: o painel nao o cria");
    const b = await rodar({ argv: ["--desde", "2026-01-01", "--ate", "2026-01-02"], secoesDir: pasta, env: envFixture });
    confere(b.codigo === 2 && b.saida.includes("não há evento no período") && b.saida.includes("BRAIN_TELEMETRIA=1"), "periodo sem evento: codigo 2 e o lembrete");
    for (const argv of [["--foo"], ["--dias"], ["--dias", "abc"], ["--dias", "0"], ["--dias", "-3"], ["--desde", "2026-11-20"], ["--desde", "2026-02-31", "--ate", "2026-03-01"], ["--desde", "2026-11-21", "--ate", "2026-11-20"], ["--dias", "2", "--desde", "2026-11-20", "--ate", "2026-11-21"], ["--amostrar", "x"], ["--amostrar", "3", "--julgar", "a"], ["solto"]]) {
      const r = await rodar({ argv, secoesDir: pasta, env: envFixture });
      confere(r.codigo === 2 && r.saida !== "", `argumento invalido ${JSON.stringify(argv)}: codigo 2 com mensagem`);
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (falhas.length) {
  console.log(`painel-teste: FALHOU ${falhas.length} de ${verificacoes} verificações`);
  for (const f of falhas) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`painel-teste: ${verificacoes} verificações OK`);

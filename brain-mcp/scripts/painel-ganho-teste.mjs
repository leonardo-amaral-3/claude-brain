// Teste da secao Ganho (card #68, F2 do epico #66), sobre fixtures sinteticas em diretorio
// temporario: nunca le transcript vivo nem grava no diario vivo. Codigo 0 ok, 1 falha, 2 uso.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { medirAproveitamento, secao } from "./painel/ganho.mjs";
import { T0, contexto, diz, item, meta, prompt, toolResult, transcript, usa } from "./fixtures/telemetria/ganho/construtor.mjs";

let falhas = 0;
export const ok = (cond, msg) => {
  if (!cond) {
    falhas++;
    console.error("FALHOU: " + msg);
  }
};
const igual = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperava ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);

const tmp = mkdtempSync(join(tmpdir(), "painel-ganho-"));
const projetos = join(tmp, "projects");
try {
  // ---- Sessao sA: um prompt por caso, em sequencia; cada janela vai ate o proximo prompt.
  const ESPEC = "/w/planning/especificacao-grande.md";
  let t = T0 + 100;
  const passo = () => (t += 1000);
  const e = [];
  const caso = (id, texto, ...resto) => e.push(prompt(id, texto, passo()), ...resto);

  caso("p-read", "como esta a spec", usa("Read", { file_path: "/w/a.md" }, passo()), toolResult("p-read", passo()), diz("li", passo()));
  caso("p-readdoc", "mostra o codigo", usa("mcp__brain__read_doc", { path: "/w/b.ts" }, passo()));
  caso("p-cita", "onde fica", diz("veja /w/planning/spec-longa.md para isso", passo()));
  caso("p-base", "onde fica", diz("o arquivo especificacao-grande.md tem a resposta", passo()));
  caso("p-curto", "onde fica", diz("abra o a.md", passo()));
  caso("p-base-prompt", "leia a especificacao-grande.md", diz("a especificacao-grande.md diz isso", passo()));
  caso("p-win", "e no windows", usa("Read", { file_path: "C:\\W\\Win.md" }, passo()));
  caso("p-side", "sidechain", usa("Read", { file_path: "/w/s.md" }, passo(), { isSidechain: true }));
  caso("p-dup", "dois trechos", usa("Read", { file_path: "/w/d.md" }, passo()));
  e.push(
    prompt("p-slash", "<command-message>gm-spec</command-message>\n<command-name>/gm-spec</command-name>\n<command-args>planejamento da telemetria do ganho</command-args>", passo()),
    meta("p-slash", "SKILL EXPANDIDA que cita /w/m.md e abre planejamento", passo()),
    usa("Read", { file_path: "/w/m.md" }, passo()),
    usa("mcp__brain__search_context", { query: "planejamento telemetria ganho" }, passo())
  );
  caso("p-rebusca-meia", "alpha gamma", usa("mcp__brain__search_context", { query: "alpha beta" }, passo()));
  caso("p-rebusca-menos", "alpha gamma", usa("mcp__brain__search_context", { query: "alpha beta delta epsilon" }, passo()));
  caso("p-rebusca-vazia", "alpha gamma", usa("mcp__brain__search_context", { query: "a b" }, passo()));
  caso("p-w1", "primeiro");
  caso("p-w2", "segundo", usa("Read", { file_path: "/w/w1.md" }, passo()));
  caso("p-sem-bloco", "nada a mostrar");
  e.push(prompt("p-cmd-local", "<local-command-stdout>x</local-command-stdout>", passo()));
  const ts = (id) => e.find((x) => x.promptId === id && x.type === "user")?.timestamp ?? new Date(T0).toISOString();
  transcript(projetos, "-w", "sA", e);

  const ev = (prompt, itens, extra = {}) => contexto({ prompt, itens, ts: Date.parse(ts(prompt)), mostrados: itens.filter((i) => i.mostrado).length, ...extra });
  const eventos = [
    ev("p-read", [item("/w/a.md", 1), item("/w/b.ts", 2), item("/w/c.md", 3, false)]),
    ev("p-readdoc", [item("/w/b.ts", 1)]),
    ev("p-cita", [item("/w/planning/spec-longa.md", 1)]),
    ev("p-base", [item(ESPEC, 1)]),
    ev("p-curto", [item("/w/a.md", 1)]),
    ev("p-base-prompt", [item(ESPEC, 1)]),
    ev("p-win", [item("C:\\w\\win.md", 1)]),
    ev("p-side", [item("/w/s.md", 1)]),
    ev("p-dup", [item("/w/d.md", 1), item("/w/d.md", 2)]),
    ev("p-slash", [item("/w/m.md", 1)], { tipo: "slash", comando: "/gm-spec" }),
    ev("p-rebusca-meia", []),
    ev("p-rebusca-menos", []),
    ev("p-rebusca-vazia", []),
    ev("p-w1", [item("/w/w1.md", 1)]),
    ev("p-sem-bloco", [], { desfecho: "sem_candidatos", jev: null }),
    ev("p-curto-desfecho", [item("/w/a.md", 1)], { desfecho: "curto" }),
    // pareamento
    ev("id-que-nao-existe", [item("/w/a.md", 1)], { ts: Date.parse(ts("p-read")) + 500 }),
    ev(null, [item("/w/a.md", 1)], { ts: Date.parse(ts("p-read")) - 1500 }),
    ev("longe", [item("/w/a.md", 1)], { ts: T0 + 9_999_999 }),
    ev("p-x", [item("/w/a.md", 1)], { sessao: "nao-existe" }),
    ev("p-y", [item("/w/a.md", 1)], { sessao: null }),
    // evento so de entidade tambem entra
    ev("p-read", [item("/w/a.md", 1)], { desfecho: "entidade", prompt: "p-read", ts: Date.parse(ts("p-read")) }),
  ];
  const m = medirAproveitamento(eventos, { projetos });
  const k = (p, s = "sA", tsx) => m.get(`${s}|${p ?? "ts:" + tsx}`);

  // a chave 'p-read' foi escrita duas vezes (injetado e entidade): a ultima vence; o caso 1 le-se
  // de um mapa sem a duplicata.
  const m1 = medirAproveitamento(eventos.slice(0, 1), { projetos }).get("sA|p-read");
  igual(m1, { par: "promptId", mostrados: ["/w/a.md", "/w/b.ts"], abertos: ["/w/a.md"], citados: [], rebusca: false }, "Read abre; nao mostrado fica fora; tool_result nao fecha a janela");
  igual(k("p-readdoc").abertos, ["/w/b.ts"], "read_doc abre");
  igual(k("p-cita").citados, ["/w/planning/spec-longa.md"], "citado por caminho");
  igual(k("p-base").citados, [ESPEC], "citado por basename >= 12");
  igual(k("p-curto").citados, [], "basename curto nao conta");
  igual(k("p-base-prompt").citados, [], "basename que o prompt ja nomeou nao conta");
  igual(k("p-win").abertos, ["C:\\w\\win.md"], "caminho com barra invertida e caixa diferente");
  igual(k("p-side").abertos, [], "sidechain ignorada");
  igual([k("p-dup").mostrados, k("p-dup").abertos], [["/w/d.md"], ["/w/d.md"]], "mesmo caminho em dois itens conta uma vez");
  const sl = k("p-slash");
  igual([sl.par, sl.abertos, sl.citados, sl.rebusca], ["promptId", ["/w/m.md"], [], true], "slash: meta com o mesmo promptId nao conta como citado; rebusca contra command-args");
  igual([k("p-rebusca-meia").rebusca, k("p-rebusca-menos").rebusca, k("p-rebusca-vazia").rebusca], [true, false, false], "rebusca: metade conta, menos de metade nao, query sem token nao");
  igual(k("p-w1").abertos, [], "a janela para no proximo prompt");
  igual(k("p-sem-bloco"), { par: "promptId", mostrados: [], abertos: [], citados: [], rebusca: false }, "desfecho sem bloco entra como linha de base");
  ok(![...m.keys()].some((x) => x.startsWith("sA|p-curto-desfecho")), "desfecho curto nao entra");
  igual(k("id-que-nao-existe").par, "horario", "par por horario (promptId ausente do transcript)");
  igual(m.get(`sA|ts:${eventos[17].ts}`).par, "horario", "chave ts: quando o prompt e nulo");
  igual(k("longe").par, "sem_par", "sem par");
  igual(k("p-x", "nao-existe").par, "sem_transcript", "sessao sem transcript");
  igual(m.get(`null|p-y`).par, "sem_transcript", "sessao nula");
  igual(m.get("sA|p-read").mostrados, ["/w/a.md"], "a chave do contrato e sessao|prompt");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
// ---- A secao: numeros esperados sobre uma fixture pequena, e o sinal do `uso`.
{
  const tmp2 = mkdtempSync(join(tmpdir(), "painel-ganho-secao-"));
  try {
    const projetos2 = join(tmp2, "projects");
    let t = T0;
    const passo = () => (t += 1000);
    const e = [];
    const tsDe = {};
    const abre = (id, texto, ...resto) => {
      const p = prompt(id, texto, passo());
      tsDe[id] = Date.parse(p.timestamp);
      e.push(p, ...resto);
    };
    abre("q1", "PROMPTSECRETO um", usa("Read", { file_path: "/w/a.md" }, passo()));
    abre("q2", "PROMPTSECRETO planejamento telemetria", diz("o /w/c.md resolve", passo()), usa("mcp__brain__search_context", { query: "planejamento telemetria" }, passo()));
    abre("q3", "PROMPTSECRETO tres", diz("nada", passo()));
    abre("q4", "PROMPTSECRETO quatro cinco", usa("mcp__brain__search_context", { query: "quatro cinco" }, passo()));
    abre("q5", "PROMPTSECRETO cinco");
    abre("q6", "PROMPTSECRETO seis", usa("Read", { file_path: "/w/e.md" }, passo()));
    abre("p-h", "PROMPTSECRETO horario", diz("nada", passo()));
    transcript(projetos2, "-w", "sA", e);

    const mk = (id, itens, extra = {}) => contexto({ prompt: id, ts: tsDe[id], itens, mostrados: itens.filter((i) => i.mostrado).length, ...extra });
    const eventos = [
      mk("q1", [item("/w/a.md", 1), item("/w/b.ts", 2)]),
      mk("q2", [item("/w/c.md", 1)], { desfecho: "entidade", jev: null }),
      mk("q3", [item("/w/d.md", 1)]),
      mk("q4", [], { desfecho: "sem_candidatos", jev: null }),
      mk("q5", [], { desfecho: "jev_reprovou_tudo" }),
      mk("q6", [item("/w/e.md", 1)], { grupo: "sem_filtro", jev: "sem_filtro_ab" }),
      mk("id-x", [item("/w/f.md", 1)], { ts: tsDe["p-h"] + 100 }),
      mk("sem-par", [item("/w/g.md", 1)], { ts: T0 + 9_999_999 }),
      mk("sem-transcript", [item("/w/h.md", 1)], { sessao: "nao-existe" }),
    ];

    // uso: com a coluna sessao
    const comColuna = new DatabaseSync(":memory:");
    comColuna.exec("CREATE TABLE uso (id INTEGER PRIMARY KEY, ts INTEGER, tool TEXT, args TEXT, ms INTEGER, resp_chars INTEGER, vazio INTEGER, semantica INTEGER, sessao TEXT, tool_use_id TEXT)");
    const ins = comColuna.prepare("INSERT INTO uso (ts, tool, args, ms, resp_chars, vazio, sessao) VALUES (?, ?, ?, 1, 1, 0, ?)");
    ins.run(tsDe.q1 + 500, "search_context", '{"query":"x"}', "sA");
    ins.run(tsDe.q1 + 600, "read_doc", '{"path":"/w/a.md"}', "sA"); // acerto
    ins.run(tsDe.q1 + 700, "read_doc", '{"path":"/w/b.ts","heading":"truncado e sem fim', "sA"); // JSON cortado: regex, acerto
    ins.run(tsDe.q1 + 800, "read_doc", '{"path":"/w/zzz.md"}', "sA"); // nao mostrado
    ins.run(tsDe.q1 + 900, "read_doc", "{}", "sA"); // sem path
    ins.run(tsDe.q1 + 950, "search_context", "{}", "outra"); // outra sessao
    ins.run(tsDe.q2 + 100, "search_context", "{}", "sA");
    ins.run(tsDe.q2 + 200, "search_context", "{}", "sA");
    ins.run(tsDe.q6 + 100, "search_context", "{}", "sA"); // janela do sem_filtro: fora da conta
    ins.run(T0 + 9_999_999 + 10 * 60 * 1000, "search_context", "{}", "sA"); // dentro dos 30 min do sem-par
    ins.run(T0 + 9_999_999 + 40 * 60 * 1000, "search_context", "{}", "sA"); // alem do teto

    const saida = await secao({ eventos, projetos: projetos2, db: comColuna });
    const tem = (trecho, msg) => ok(saida.includes(trecho), `${msg}: faltou «${trecho}» em\n${saida}`);
    tem("Prompts com injeção (fora do grupo sem_filtro): 6", "o sem_filtro fica fora dos prompts com injecao");
    tem("casados por promptId 3, por horário 1; sem par no transcript 1; sem transcript 1", "contagem do pareamento");
    // com par: q1 (2 mostrados, 1 aberto), q2 (1 mostrado, 1 citado), q3 (1, 0), id-x (1, 0)
    tem("trechos mostrados 5, aproveitados 2 (abertos 1, citados 1); taxa de aproveitamento 40,0%", "taxa de aproveitamento");
    tem("prompts com ao menos um trecho aproveitado: 2 de 4 (50,0%)", "prompts com algum aproveitado");
    tem("rebusca: 1 de 4 (25,0%)", "rebusca dos prompts com injecao");
    tem("jev_reprovou_tudo): 1 de 2 (50,0%)", "linha de base da rebusca");
    tem("só vale comparada", "aviso da rebusca");
    tem("Por desfecho, entidade (1 prompts com par):", "bloco da entidade");
    tem("trechos mostrados 1, aproveitados 1 (abertos 0, citados 1); taxa de aproveitamento 100,0%", "entidade");
    tem("Por desfecho, injetado (3 prompts com par):", "bloco do injetado");
    tem("trechos mostrados 4, aproveitados 1 (abertos 1, citados 0); taxa de aproveitamento 25,0%", "injetado");
    tem("eventos com injeção: 6; chamadas a search_context na janela: 4; a read_doc: 4", "sinal do uso: contagens");
    tem("read_doc de caminho que a injeção mostrou: 2", "sinal do uso: acertos (JSON inteiro e cortado)");
    // R1: nem caminho nem texto de prompt
    ok(!/\/w\/|PROMPTSECRETO|a\.md/.test(saida), "a secao imprimiu caminho ou texto de prompt");

    // sem a coluna sessao e sem db
    const semColuna = new DatabaseSync(":memory:");
    semColuna.exec("CREATE TABLE uso (id INTEGER PRIMARY KEY, ts INTEGER, tool TEXT, args TEXT, ms INTEGER, resp_chars INTEGER, vazio INTEGER)");
    for (const db of [semColuna, null]) {
      const s2 = await secao({ eventos, projetos: projetos2, db });
      ok(s2.includes("uso sem sessão (servidor anterior à F2)"), "sem coluna/db devia dizer que o uso nao tem sessao");
    }
    // sem transcript nenhum casado
    const s3 = await secao({ eventos: [eventos[8]], projetos: projetos2, db: null });
    ok(s3.includes("nenhum prompt com injeção casou com transcript"), "sem par: nao ha taxa");
  } finally {
    rmSync(tmp2, { recursive: true, force: true });
  }
}

if (falhas) {
  console.error(`${falhas} falha(s)`);
  process.exit(1);
}
console.log("painel-ganho-teste OK");

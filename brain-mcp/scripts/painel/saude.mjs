// Secao `Saude e custo` do painel (claude-brain#66, F1, CA1): o que o hook de contexto e o Jev fazem
// e quanto custam, lido so do diario de eventos, sem abrir transcript.
//
// So contagens, percentuais, nomes de `uso`, desfechos e motivos (R1): nunca caminho nem texto de
// prompt, e por isso a saida pode ir para PR e card. Todo nome que vem do arquivo passa por uma lista
// fechada (o diario e do disco: uma linha adulterada nao pode vazar texto pela saida).

const DESFECHOS = ["injetado", "entidade", "jev_reprovou_tudo", "sem_candidatos", "sem_enviaveis", "curto", "ignorado", "sem_indice", "sem_payload", "erro"];
// Os desfechos em que o hook chegou a buscar: so neles `ms_total` mede o trabalho de verdade.
const BUSCARAM = ["entidade", "sem_candidatos", "sem_enviaveis", "jev_reprovou_tudo", "injetado"];
const JEVS = ["ok", "indisponivel", "prazo_hook", "erro", "sem_chave", "sem_enviaveis", "desligado", "sem_filtro_ab"];
const MOTIVOS = ["desligado", "sem_chave", "timeout", "http", "rede", "resposta_invalida", "entrada_invalida"];
const USOS = ["contexto", "triagem", "spec", "parada", "roteador", "lembrar"];
const CLIENTES = ["api", "falso", "sem_chave", "invalida"];
const GRUPOS = ["com_filtro", "sem_filtro"];

// Percentil do repo (uso.mjs): indice floor(p * (n - 1)) no vetor ordenado.
const pct = (v, p) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(p * (v.length - 1))] : null);
const num = (x) => typeof x === "number" && Number.isFinite(x);
const ms = (v) => (v.length ? `p50 ${pct(v, 0.5)} ms · p90 ${pct(v, 0.9)} ms (n=${v.length})` : "sem medida");
const porcento = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
const dentro = (valor, lista, resto) => (lista.includes(valor) ? valor : resto);

function contar(valores) {
  const m = new Map();
  for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function secaoHook(eventos) {
  const l = [];
  const n = eventos.length;
  l.push(`Hook de contexto: ${n} execuções`);
  if (!n) return l;
  const por = contar(eventos.map((e) => dentro(e.desfecho, DESFECHOS, "(desconhecido)")));
  l.push("  por desfecho:");
  for (const d of [...DESFECHOS, "(desconhecido)"]) {
    if (por.has(d)) l.push(`    ${d.padEnd(18)} ${String(por.get(d)).padStart(5)}  ${porcento(por.get(d), n).padStart(6)}`);
  }
  const totais = (lista) => lista.map((e) => e.ms_total).filter(num);
  l.push(`  ms_total, desfechos que buscaram: ${ms(totais(eventos.filter((e) => BUSCARAM.includes(e.desfecho))))}`);
  l.push(`  ms_total, todos:                  ${ms(totais(eventos))}   (sem a partida do node)`);
  l.push(`  ms_busca: ${ms(eventos.map((e) => e.ms_busca).filter(num))}`);
  l.push(`  ms_jev:   ${ms(eventos.map((e) => e.ms_jev).filter(num))}`);

  const jevs = contar(eventos.map((e) => (e.jev == null ? null : dentro(e.jev, JEVS, "(desconhecido)"))));
  l.push("  chamada ao Jev no hook:");
  for (const j of [...JEVS, "(desconhecido)", null]) {
    if (!jevs.has(j)) continue;
    l.push(`    ${(j ?? "(sem chamada)").padEnd(18)} ${String(jevs.get(j)).padStart(5)}`);
    if (j === "indisponivel") {
      const motivos = contar(eventos.filter((e) => e.jev === "indisponivel").map((e) => (e.jev_motivo == null ? "(sem motivo)" : dentro(e.jev_motivo, MOTIVOS, "(outro)"))));
      for (const [m, c] of motivos) l.push(`      motivo ${m}: ${c}`);
    }
  }
  const ok = eventos.filter((e) => e.jev === "ok").length;
  const reprovou = eventos.filter((e) => e.desfecho === "jev_reprovou_tudo").length;
  l.push(`  o Jev reprovou todos os trechos: ${reprovou} de ${ok} chamadas ok = ${porcento(reprovou, ok)}`);

  const grupos = GRUPOS.map((g) => [g, eventos.filter((e) => e.grupo === g).length]);
  l.push(`  prompts sorteados no A/B: ${grupos.map(([g, c]) => `${g} ${c}`).join(" · ")}  (a conta do ganho é da seção Ganho)`);
  return l;
}

function secaoJev(eventos) {
  const l = [];
  l.push(`Jev, todo uso: ${eventos.length} chamadas`);
  if (!eventos.length) return l;
  const usoDe = (e) => dentro(e.uso, USOS, "(fora da tabela)");
  for (const uso of [...USOS, "(fora da tabela)"]) {
    const doUso = eventos.filter((e) => usoDe(e) === uso);
    if (!doUso.length) continue;
    const itens = doUso.reduce((a, e) => a + (num(e.itens) ? e.itens : 0), 0);
    const motivos = new Map();
    for (const e of doUso) {
      for (const [m, c] of Object.entries(e.motivos && typeof e.motivos === "object" ? e.motivos : {})) {
        if (!num(c)) continue;
        const k = dentro(m, MOTIVOS, "(outro)");
        motivos.set(k, (motivos.get(k) ?? 0) + c);
      }
    }
    const indisp = [...motivos.values()].reduce((a, c) => a + c, 0);
    l.push(`  ${uso}: ${doUso.length} chamadas · ${itens} itens · ${ms(doUso.map((e) => e.ms).filter(num))} · indisponíveis ${indisp}`);
    if (indisp) l.push(`    motivos: ${[...motivos].map(([m, c]) => `${m} ${c}`).join(" · ")}`);
  }
  const clientes = contar(eventos.map((e) => dentro(e.cliente, CLIENTES, "(outro)")));
  l.push(`  por cliente: ${[...CLIENTES, "(outro)"].filter((c) => clientes.has(c)).map((c) => `${c} ${clientes.get(c)}`).join(" · ")}`);

  const tokens = new Map();
  for (const e of eventos) {
    if (!e.tokens || typeof e.tokens !== "object") continue;
    for (const [k, v] of Object.entries(e.tokens)) {
      if (num(v) && /^[a-z_]{1,40}$/.test(k)) tokens.set(k, (tokens.get(k) ?? 0) + v);
    }
  }
  l.push(tokens.size ? `  tokens somados: ${[...tokens].map(([k, v]) => `${k} ${v}`).join(" · ")}` : "  a API não devolveu uso de tokens no período");
  return l;
}

/** @param {{ eventos: object[] }} ctx */
export async function secao(ctx) {
  const contexto = ctx.eventos.filter((e) => e.evento === "contexto");
  const jev = ctx.eventos.filter((e) => e.evento === "jev");
  return ["Saúde e custo", "", ...secaoHook(contexto), "", ...secaoJev(jev)].join("\n");
}

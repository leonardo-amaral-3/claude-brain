#!/usr/bin/env node
// Testa skills/gm-spec/sensivel.mjs sem rede e sem framework (padrão de skills-comum-teste.mjs).
// Uso: node scripts/gm-spec-sensivel-teste.mjs
// Sai 0 se todos os cenários passam, 1 se algum falha.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const caminhoModulo = join(aqui, "..", "skills", "gm-spec", "sensivel.mjs");
const { CATEGORIAS, PERGUNTAS, carregarJev, classificar, decidir, unir, montarLinha } = await import(pathToFileURL(caminhoModulo).href);

let falhas = 0;
function afirmar(ok, msg) {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${msg}`);
  if (!ok) falhas++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Monta um objeto com o mesmo valor nas quatro categorias, e permite trocar algumas.
const nas4 = (valor, trocas = {}) => Object.fromEntries(CATEGORIAS.map((c) => [c, c in trocas ? trocas[c] : valor]));
const nao = (confianca) => ({ estado: "ok", resposta: "nao", confianca });
const sim = (confianca) => ({ estado: "ok", resposta: "sim", confianca });
const indisponivel = { estado: "indisponivel", motivo: "teste" };

console.log("decidir: a regra de CA1, fechada por inversão");
{
  let r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95)) });
  afirmar(r.sensivel === false && igual(r.motivos, []), "autor nao ×4 e Jev nao 0,95 ×4 → não sensível, sem motivos");

  r = decidir({ autor: nas4("nao", { dado: "sim" }), jev: nas4(nao(0.99)) });
  afirmar(igual(r.motivos, ["autor"]) && r.sensivel, "autor dado=sim, Jev nao 0,99 → só autor (o Jev não dispensa)");
  afirmar(igual(r.categorias.dado.motivos, ["autor"]) && igual(r.categorias.deploy.motivos, []), "o motivo fica só na categoria afetada");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { deploy: sim(0.6) }) });
  afirmar(igual(r.motivos, ["jev-sim"]) && igual(r.categorias.deploy.motivos, ["jev-sim"]), "Jev deploy sim 0,60 → jev-sim em deploy");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { deploy: sim(0.01) }) });
  afirmar(igual(r.motivos, ["jev-sim"]), "Jev sim vale em qualquer confiança");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { migration: nao(0.89) }) });
  afirmar(igual(r.motivos, ["confianca-baixa"]), "Jev migration nao 0,89 → confiança baixa");
  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { migration: nao(0.9) }) });
  afirmar(r.sensivel === false, "Jev migration nao 0,90 exato → não sensível (a borda é limpa)");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { faturamento: indisponivel }) });
  afirmar(igual(r.motivos, ["jev-indisponivel"]), "Jev faturamento indisponível → jev-indisponivel");

  r = decidir({ autor: nas4("sim"), jev: nas4(indisponivel) });
  afirmar(igual(r.motivos, ["autor", "jev-indisponivel"]), "autor sim + Jev indisponível → autor, jev-indisponivel, nessa ordem");
}

console.log("decidir: valor inesperado nunca deixa passar (fail-closed)");
{
  const jevLimpo = nas4(nao(0.95));
  for (const [rotulo, valor] of [["undefined", undefined], ['"Sim"', "Sim"], ['"não"', "não"], ["null", null]]) {
    const r = decidir({ autor: nas4(valor), jev: jevLimpo });
    afirmar(r.sensivel && CATEGORIAS.every((c) => igual(r.categorias[c].motivos, ["autor"])), `autor ${rotulo} → motivo autor nas quatro`);
  }

  let r = decidir({ autor: { dado: "nao", faturamento: "nao", migration: "nao" }, jev: jevLimpo });
  afirmar(igual(r.categorias.deploy.motivos, ["autor"]) && igual(r.categorias.dado.motivos, []), "autor sem a chave deploy → autor só em deploy");

  const { dado, ...semDado } = jevLimpo;
  r = decidir({ autor: nas4("nao"), jev: semDado });
  afirmar(igual(r.categorias.dado.motivos, ["jev-indisponivel"]) && igual(r.categorias.deploy.motivos, []), "jev sem a chave dado → jev-indisponivel só em dado");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { dado: nao(NaN) }) });
  afirmar(igual(r.categorias.dado.motivos, ["jev-indisponivel"]), "confianca NaN → jev-indisponivel (resposta inválida)");

  r = decidir({ autor: nas4("nao"), jev: nas4(nao(0.95), { dado: nao(1.5) }) });
  afirmar(igual(r.categorias.dado.motivos, ["jev-indisponivel"]), "confianca fora de [0,1] → jev-indisponivel");

  r = decidir({ autor: nas4("nao"), jev: undefined });
  afirmar(CATEGORIAS.every((c) => igual(r.categorias[c].motivos, ["jev-indisponivel"])), "jev inteiro undefined → jev-indisponivel nas quatro");

  r = decidir({ autor: nas4("nao"), jev: nas4({ resposta: "talvez" }) });
  afirmar(CATEGORIAS.every((c) => igual(r.categorias[c].motivos, ["jev-indisponivel"])), "resposta fora do contrato → jev-indisponivel");
}

console.log("montarLinha: texto exato");
{
  const m = (motivos, categorias) => Object.fromEntries(CATEGORIAS.map((c) => [c, categorias.includes(c) ? motivos : []]));
  const autorDado = { ...m(["jev-indisponivel"], CATEGORIAS), dado: ["autor", "jev-indisponivel"] };
  afirmar(montarLinha(autorDado) === "Spec sensível: sim — autor (dado); Jev indisponível (as quatro)", "autor (dado); Jev indisponível (as quatro)");
  afirmar(montarLinha(m([], [])) === "Spec sensível: não", "sem motivos → Spec sensível: não");
  afirmar(
    montarLinha(m(["confianca-baixa"], ["faturamento", "migration"])) === "Spec sensível: sim — confiança baixa (faturamento, migration)",
    "duas categorias → confiança baixa (faturamento, migration)",
  );
  afirmar(
    montarLinha({ dado: ["jev-indisponivel", "autor"], faturamento: [], deploy: [], migration: [] }) === "Spec sensível: sim — autor (dado); Jev indisponível (dado)",
    "os motivos saem na ordem de MOTIVOS, não na ordem de entrada",
  );
}

console.log("unir: o veredito só cresce");
{
  const vazio = nas4([]);
  let r = unir({ ...vazio, dado: ["autor"] }, vazio);
  afirmar(igual(r.uniao.dado, ["autor"]) && igual(r.novos, []), "autor em dado antes, atual limpo → dado continua com autor, sem novos");

  r = unir(vazio, { ...vazio, deploy: ["jev-sim"] });
  afirmar(igual(r.uniao.deploy, ["jev-sim"]) && igual(r.novos, ["jev-sim:deploy"]), "jev-sim novo em deploy → entra em novos");

  r = unir(vazio, { ...vazio, deploy: ["jev-indisponivel"], dado: ["confianca-baixa"] });
  afirmar(igual(r.novos, []) && igual(r.uniao.deploy, ["jev-indisponivel"]), "jev-indisponivel e confiança baixa novos não entram em novos");

  r = unir({ ...vazio, deploy: ["jev-sim"] }, { ...vazio, deploy: ["jev-sim", "autor"] });
  afirmar(igual(r.uniao.deploy, ["autor", "jev-sim"]) && igual(r.novos, ["autor:deploy"]), "só o par que não estava antes é novo; a união sai em ordem de MOTIVOS");

  r = unir(undefined, { ...vazio, migration: ["autor"] });
  afirmar(igual(r.uniao.migration, ["autor"]) && igual(r.novos, ["autor:migration"]), "sem rodada anterior → anterior vazio");

  r = unir({ dado: { motivos: ["autor"] } }, vazio);
  afirmar(igual(r.uniao.dado, ["autor"]), "aceita também a forma { categoria: { motivos } } do decidir");
}

console.log("classificar: sempre com Jev falso, sem rede (CA1, CA4, CA5, CA10)");
{
  // Texto inócuo e com bytes que um truncamento ou uma reencodificação estragariam.
  const texto = "# Spec de teste\n\nUma mudança qualquer, sem dado de ninguém. ção — 日本 😀\n".repeat(50);
  const quatro = (r, motivo) => CATEGORIAS.every((c) => r.jev[c].estado === "indisponivel" && r.jev[c].motivo === motivo);
  const jevFalso = (extra = {}) => ({ origem: "/falso/jev.mjs", perguntar: async () => nao(0.95), ...extra });
  const com = (jev) => async () => jev;

  // Captura stdout e stderr enquanto `fn` roda; devolve o que cada um recebeu.
  async function capturando(fn) {
    const escritaOut = process.stdout.write;
    const escritaErr = process.stderr.write;
    const saida = { stdout: "", stderr: "" };
    process.stdout.write = (pedaco) => ((saida.stdout += String(pedaco)), true);
    process.stderr.write = (pedaco) => ((saida.stderr += String(pedaco)), true);
    try {
      saida.resultado = await fn();
    } finally {
      process.stdout.write = escritaOut;
      process.stderr.write = escritaErr;
    }
    return saida;
  }

  // O Jev falso grava cada chamada: as quatro PERGUNTAS, e o texto byte a byte.
  {
    const chamadas = [];
    const jev = jevFalso({ perguntar: async (pergunta, trecho) => (chamadas.push({ pergunta, trecho }), nao(0.95)) });
    const r = await classificar({ texto, carregar: com(jev), optIn: true });
    afirmar(chamadas.length === 4, "o Jev recebe exatamente quatro perguntas");
    afirmar(igual(chamadas.map((x) => x.pergunta).sort(), Object.values(PERGUNTAS).sort()), "as perguntas são as quatro de PERGUNTAS");
    afirmar(chamadas.every((x) => x.trecho === texto), "o trecho de cada chamada é igual, byte a byte, ao texto");
    afirmar(CATEGORIAS.every((c) => igual(r.jev[c], nao(0.95))) && r.cliente === "/falso/jev.mjs", "as respostas válidas passam normalizadas e o cliente é a origem");
    afirmar(igual(r.jev.dado, nao(0.95)) && PERGUNTAS.dado === chamadas.find((x) => x.pergunta === PERGUNTAS.dado)?.pergunta, "cada resposta fica na categoria da sua pergunta");
  }

  // Cada pergunta volta na categoria certa mesmo com respostas diferentes.
  {
    const porPergunta = new Map([[PERGUNTAS.dado, sim(0.7)], [PERGUNTAS.faturamento, nao(0.95)], [PERGUNTAS.deploy, nao(0.5)], [PERGUNTAS.migration, sim(0.99)]]);
    const r = await classificar({ texto, carregar: com(jevFalso({ perguntar: async (p) => porPergunta.get(p) })), optIn: true });
    afirmar(CATEGORIAS.every((c) => igual(r.jev[c], porPergunta.get(PERGUNTAS[c]))), "resposta de cada pergunta cai na sua categoria");
  }

  // CA10: sem opt-in, carregar nunca é chamado.
  {
    let chamado = 0;
    const r = await classificar({ texto, carregar: async () => (chamado++, jevFalso()), optIn: false });
    afirmar(chamado === 0, "optIn false → carregar não é chamado");
    afirmar(quatro(r, "envio de spec ao Jev não autorizado nesta máquina") && r.cliente === null, "optIn false → quatro indisponíveis com o motivo do opt-in");
  }

  // CA4: sem cliente.
  {
    const r = await classificar({ texto, carregar: async () => null, optIn: true });
    afirmar(quatro(r, "cliente do Jev não encontrado") && r.cliente === null, "carregar devolve null → cliente do Jev não encontrado");
  }

  // CA5: carregar que nunca resolve; o teste termina porque o temporizador é limpo.
  {
    const inicio = Date.now();
    const r = await classificar({ texto, carregar: () => new Promise(() => {}), optIn: true, orcamentoMs: 50 });
    afirmar(quatro(r, "tempo esgotado ao carregar o cliente"), "carregar que nunca resolve → tempo esgotado ao carregar o cliente");
    afirmar(Date.now() - inicio < 2000, "o orçamento de 50 ms corta a espera");
  }

  // carregar que rejeita (é o que carregarJev faz quando o jev.js existe e não carrega): fail-closed.
  {
    const r = await classificar({ texto, carregar: async () => { throw new TypeError("sk-segredo"); }, optIn: true });
    afirmar(quatro(r, "falhou ao carregar o cliente (TypeError)") && !JSON.stringify(r).includes("sk-segredo"), "carregar que rejeita → falhou ao carregar, só o name do erro");
  }

  // perguntar que lança síncrono e que rejeita com segredo na message: só o name, nunca a message.
  {
    const sincrono = jevFalso({ perguntar: () => { throw new Error("sk-segredo"); } });
    let r = await classificar({ texto, carregar: com(sincrono), optIn: true });
    afirmar(quatro(r, "erro do cliente (Error)"), "perguntar que lança síncrono → erro do cliente (Error)");
    afirmar(!JSON.stringify(r).includes("sk-segredo"), "throw síncrono: a message não vaza");

    const rejeita = jevFalso({ perguntar: async () => { throw new RangeError("sk-segredo"); } });
    r = await classificar({ texto, carregar: com(rejeita), optIn: true });
    afirmar(quatro(r, "erro do cliente (RangeError)") && !JSON.stringify(r).includes("sk-segredo"), "perguntar que rejeita com message sensível → só o name, sem vazar");

    const rejeitaGenerico = jevFalso({ perguntar: async () => { throw new Error("sk-segredo"); } });
    r = await classificar({ texto, carregar: com(rejeitaGenerico), optIn: true });
    afirmar(quatro(r, "erro do cliente (Error)") && !JSON.stringify(r).includes("sk-segredo"), "rejeição com Error e sk-segredo na message → erro do cliente (Error), sem vazar");

    const rejeitaString = jevFalso({ perguntar: async () => { throw "sk-segredo"; } });
    r = await classificar({ texto, carregar: com(rejeitaString), optIn: true });
    afirmar(quatro(r, "erro do cliente (desconhecido)") && !JSON.stringify(r).includes("sk-segredo"), "rejeição que não é Error → nome desconhecido, sem vazar");
  }

  // perguntar que nunca resolve.
  {
    const r = await classificar({ texto, carregar: com(jevFalso({ perguntar: () => new Promise(() => {}) })), optIn: true, orcamentoMs: 50 });
    afirmar(quatro(r, "tempo esgotado") && r.cliente === "/falso/jev.mjs", "perguntar que nunca resolve → tempo esgotado");
  }

  // Resposta fora do contrato.
  {
    const respostas = new Map([[PERGUNTAS.dado, { resposta: "talvez" }], [PERGUNTAS.faturamento, { estado: "ok", resposta: "nao", confianca: 1.5 }], [PERGUNTAS.deploy, undefined], [PERGUNTAS.migration, { estado: "ok", resposta: "sim", confianca: NaN }]]);
    const r = await classificar({ texto, carregar: com(jevFalso({ perguntar: async (p) => respostas.get(p) })), optIn: true });
    afirmar(quatro(r, "resposta inválida"), "talvez, confiança 1,5, undefined e NaN → resposta inválida");
  }

  // O Jev que se diz indisponível passa o próprio motivo.
  {
    const r = await classificar({ texto, carregar: com(jevFalso({ perguntar: async () => ({ estado: "indisponivel", motivo: "sem chave" }) })), optIn: true });
    afirmar(quatro(r, "sem chave"), "resposta indisponivel do cliente mantém o motivo dele");
  }

  // Limite do cliente: não pergunta e não trunca.
  {
    let perguntou = 0;
    let recebido;
    const jev = jevFalso({ cabe: (t) => ((recebido = t), false), perguntar: async () => (perguntou++, nao(0.95)) });
    const r = await classificar({ texto, carregar: com(jev), optIn: true });
    afirmar(quatro(r, "spec maior que o limite do cliente") && perguntou === 0, "cabe false → spec maior que o limite do cliente, perguntar não chamado");
    afirmar(recebido === texto, "cabe recebe o texto inteiro");
    afirmar(r.cliente === "/falso/jev.mjs", "o cliente sai mesmo quando a spec não cabe");

    const cabendo = jevFalso({ cabe: () => true });
    const r2 = await classificar({ texto, carregar: com(cabendo), optIn: true });
    afirmar(CATEGORIAS.every((c) => r2.jev[c].estado === "ok"), "cabe true → pergunta normalmente");
  }

  // Saída limpa: o que o cliente imprime vai ao stderr, e os métodos voltam ao normal depois.
  {
    const escritaOriginal = process.stdout.write;
    const logOriginal = console.log;
    const jev = jevFalso({
      perguntar: async () => {
        console.log("log-do-cliente");
        console.info("info-do-cliente");
        console.debug("debug-do-cliente");
        process.stdout.write("escrita-do-cliente\n");
        return nao(0.95);
      },
    });
    const capturado = await capturando(() => classificar({ texto, carregar: com(jev), optIn: true }));
    afirmar(capturado.stdout === "", "nada do que o cliente imprime chega ao stdout");
    afirmar(["log-do-cliente", "info-do-cliente", "debug-do-cliente", "escrita-do-cliente"].every((t) => capturado.stderr.includes(t)), "tudo isso vai ao stderr");
    afirmar(CATEGORIAS.every((c) => capturado.resultado.jev[c].estado === "ok"), "a classificação segue normal");
    afirmar(process.stdout.write === escritaOriginal && console.log === logOriginal, "stdout.write e console.log voltam ao que eram");

    // Também restaura quando o cliente falha.
    const falha = jevFalso({ perguntar: async () => { throw new Error("x"); } });
    await capturando(() => classificar({ texto, carregar: com(falha), optIn: true }));
    afirmar(process.stdout.write === escritaOriginal && console.log === logOriginal, "restaura também quando o cliente falha");
  }
}

console.log("CLI: o script como processo, em diretório temporário e ambiente isolado");
{
  const AUTOR_NAO = "dado=nao,faturamento=nao,deploy=nao,migration=nao";
  const LINHA_FIXA = "Spec sensível: sim — Jev indisponível (as quatro)";
  const raiz = mkdtempSync(join(tmpdir(), "gm-spec-sensivel-"));
  try {
    // Só o sensivel.mjs é copiado: sem cliente do Jev por perto, e o ambiente sem HOME real.
    const casa = join(raiz, "casa");
    const pasta = join(casa, "p");
    mkdirSync(pasta, { recursive: true });
    const script = join(casa, "sensivel.mjs");
    copyFileSync(caminhoModulo, script);
    const ambiente = { PATH: process.env.PATH, HOME: casa, CLAUDE_CONFIG_DIR: casa };
    const specFixture = "# Spec de exemplo\n\nAjusta o texto de uma mensagem de ajuda da interface.\n";
    const caminhoSpec = join(pasta, "spec.md");
    const registroDe = (dir = pasta) => join(dir, "sensibilidade.json");
    const rodar = (argumentos, executavel = script) =>
      spawnSync(process.execPath, [executavel, ...argumentos], { env: ambiente, encoding: "utf8", timeout: 30000 });
    const umaLinhaJson = (r) => {
      const linhas = r.stdout.split("\n").filter((l) => l !== "");
      if (linhas.length !== 1) return null;
      try { return JSON.parse(linhas[0]); } catch { return null; }
    };
    writeFileSync(caminhoSpec, specFixture);

    // Sem opt-in: nada vai ao Jev, as quatro ficam indisponíveis e a spec é sensível.
    {
      const r = rodar(["--spec", caminhoSpec, "--autor", AUTOR_NAO]);
      const saida = umaLinhaJson(r);
      afirmar(r.status === 0 && saida !== null, "sem opt-in: código 0 e uma linha JSON");
      afirmar(saida?.sensivel === true && saida.linha === LINHA_FIXA, "sem opt-in: sensível, com a linha fixa");
      afirmar(saida?.optIn === false && saida.cliente === null, "sem opt-in: optIn false, cliente null");
      afirmar(saida?.sha256 === createHash("sha256").update(specFixture).digest("hex") && saida.bytes === Buffer.byteLength(specFixture), "sha256 e bytes são os do arquivo");
      afirmar(CATEGORIAS.every((c) => saida?.categorias[c].jev.motivo === "envio de spec ao Jev não autorizado nesta máquina"), "o motivo do Jev é o do opt-in, nas quatro");
      afirmar(igual(saida?.motivos, ["jev-indisponivel"]) && igual(saida?.novos, []) && saida?.limiar === 0.9, "motivos, novos e limiar");
      const registro = JSON.parse(readFileSync(registroDe(), "utf8"));
      afirmar(registro.rodadas.length === 1 && registro.rodadas[0].sha256 === saida?.sha256, "sensibilidade.json nasce com uma rodada");
      afirmar(CATEGORIAS.every((c) => igual(registro.uniao[c], ["jev-indisponivel"])), "a união do registro tem jev-indisponivel nas quatro");
      afirmar(!readFileSync(registroDe(), "utf8").includes("Ajusta o texto"), "nenhum texto da spec vai para o registro");
    }

    // Opt-in ligado, mas sem cliente instalado: ainda sensível, agora por outro motivo.
    {
      writeFileSync(join(casa, "gm-spec-jev.json"), JSON.stringify({ enviarSpecAoJev: true }));
      const pastaB = join(casa, "b");
      mkdirSync(pastaB);
      writeFileSync(join(pastaB, "spec.md"), specFixture);
      const r = rodar(["--spec", join(pastaB, "spec.md"), "--autor", AUTOR_NAO]);
      const saida = umaLinhaJson(r);
      afirmar(r.status === 0 && saida?.optIn === true && saida.sensivel === true, "com opt-in: optIn true, ainda sensível");
      afirmar(CATEGORIAS.every((c) => saida?.categorias[c].jev.motivo === "cliente do Jev não encontrado"), "com opt-in e sem cliente: cliente do Jev não encontrado");
      rmSync(join(casa, "gm-spec-jev.json"));
    }

    // Duas rodadas: o veredito só cresce, mesmo com outro --autor.
    {
      const pastaC = join(casa, "c");
      mkdirSync(pastaC);
      const specC = join(pastaC, "spec.md");
      writeFileSync(specC, specFixture);
      const primeira = umaLinhaJson(rodar(["--spec", specC, "--autor", "dado=sim,faturamento=nao,deploy=nao,migration=nao"]));
      afirmar(primeira?.novos.includes("autor:dado"), "1ª rodada: autor dado=sim entra em novos");
      const segunda = umaLinhaJson(rodar(["--spec", specC, "--autor", AUTOR_NAO]));
      afirmar(segunda?.linha.includes("autor (dado)"), "2ª rodada com nao ×4: a linha ainda tem autor (dado)");
      afirmar(igual(segunda?.categorias.dado.motivos, ["autor", "jev-indisponivel"]), "categorias[c].motivos é o da união");
      afirmar(igual(segunda?.novos, []), "2ª rodada: autor dado já estava, novos vazio");
      afirmar(JSON.parse(readFileSync(registroDe(pastaC), "utf8")).rodadas.length === 2, "o registro tem duas rodadas");
    }

    // Registro corrompido: código 2, stdout vazio, e o arquivo não é tocado.
    {
      const pastaD = join(casa, "d");
      mkdirSync(pastaD);
      const specD = join(pastaD, "spec.md");
      writeFileSync(specD, specFixture);
      for (const [rotulo, conteudo] of [["texto que não é JSON", "{quebrado"], ["JSON sem rodadas e uniao", "{}"], ["rodadas que não é array", '{"rodadas":{},"uniao":{}}']]) {
        writeFileSync(registroDe(pastaD), conteudo);
        const r = rodar(["--spec", specD, "--autor", AUTOR_NAO]);
        afirmar(r.status === 2 && r.stdout === "" && r.stderr.includes("sensibilidade.json ilegível"), `registro com ${rotulo} → código 2, stdout vazio`);
        afirmar(readFileSync(registroDe(pastaD), "utf8") === conteudo, "o registro corrompido fica como estava");
      }
    }

    // Erros de uso: código 2 e nada no stdout.
    {
      const vazio = join(casa, "vazio");
      mkdirSync(vazio);
      writeFileSync(join(vazio, "spec.md"), "  \n\t\n");
      const outroNome = join(casa, "d", "outro.md");
      writeFileSync(outroNome, specFixture);
      const casos = [
        ["--autor incompleto", ["--spec", caminhoSpec, "--autor", "dado=nao,faturamento=nao,deploy=nao"]],
        ["valor talvez", ["--spec", caminhoSpec, "--autor", "dado=talvez,faturamento=nao,deploy=nao,migration=nao"]],
        ["categoria repetida", ["--spec", caminhoSpec, "--autor", "dado=nao,dado=nao,faturamento=nao,deploy=nao,migration=nao"]],
        ["categoria desconhecida", ["--spec", caminhoSpec, "--autor", "dado=nao,faturamento=nao,deploy=nao,migration=nao,seguranca=nao"]],
        ["--autor repetido", ["--spec", caminhoSpec, "--autor", AUTOR_NAO, "--autor", AUTOR_NAO]],
        ["--spec repetido", ["--spec", caminhoSpec, "--spec", caminhoSpec, "--autor", AUTOR_NAO]],
        ["argumento posicional", [caminhoSpec, "--spec", caminhoSpec, "--autor", AUTOR_NAO]],
        ["--spec sem valor", ["--autor", AUTOR_NAO, "--spec"]],
        ["sem --autor", ["--spec", caminhoSpec]],
        ["sem --spec", ["--autor", AUTOR_NAO]],
        ["--spec inexistente", ["--spec", join(casa, "nao-existe", "spec.md"), "--autor", AUTOR_NAO]],
        ["--spec vazio", ["--spec", join(vazio, "spec.md"), "--autor", AUTOR_NAO]],
        ["--spec que não se chama spec.md", ["--spec", outroNome, "--autor", AUTOR_NAO]],
      ];
      for (const [rotulo, argumentos] of casos) {
        const r = rodar(argumentos);
        afirmar(r.status === 2 && r.stdout === "" && r.stderr !== "", `uso: ${rotulo} → código 2, stdout vazio, mensagem no stderr`);
      }
      afirmar(!existsSync(registroDe(vazio)), "spec vazio não cria registro");
    }

    // Link simbólico para o sensivel.mjs: continua sendo o ponto de entrada.
    {
      const pastaE = join(casa, "e");
      mkdirSync(pastaE);
      writeFileSync(join(pastaE, "spec.md"), specFixture);
      const atalho = join(casa, "atalho.mjs");
      symlinkSync(script, atalho);
      const r = rodar(["--spec", join(pastaE, "spec.md"), "--autor", AUTOR_NAO], atalho);
      afirmar(r.status === 0 && umaLinhaJson(r) !== null, "por link simbólico: roda o main (código 0, uma linha JSON)");
    }
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
}

console.log("carregarJev: a fronteira com o contrato do #42, com um jev.js falso e sem rede");
{
  const raiz = mkdtempSync(join(tmpdir(), "gm-spec-fronteira-"));
  try {
    // Instala um `hooks/jev.js` falso numa CLAUDE_HOME temporária; `corpo` é o que ele exporta.
    let contador = 0;
    const instalar = (corpo) => {
      const casa = join(raiz, `casa-${++contador}`);
      mkdirSync(join(casa, "hooks"), { recursive: true });
      writeFileSync(join(casa, "hooks", "jev.js"), corpo);
      return casa;
    };
    const respostaFalsa = (resposta) => `
      // Uma lista de chamadas por instalação (a pasta do módulo): vários falsos convivem no mesmo processo.
      const chamadas = ((globalThis.__chamadasJev ??= {})[__dirname] = []);
      module.exports = {
        MAX_ESTADO: 50,
        decidir: async (estado, perguntas, opcoes) => { chamadas.push({ estado, perguntas, opcoes }); return { sensivel: ${JSON.stringify(resposta)} }; },
      };`;

    // R1: sem cliente na instalação → null ("não encontrado"). Presente mas quebrado ou fora da forma →
    // rejeita com o name do erro ("falhou ao carregar"): a mensagem não pode dizer que o arquivo não
    // existe quando ele está lá (achado 7 do G4).
    const nomeDaRejeicao = async (promessa) => promessa.then(() => "resolveu", (erro) => erro?.name);
    afirmar((await carregarJev({ claudeHome: join(raiz, "vazia") })) === null, "R1: sem hooks/jev.js → null");
    afirmar((await nomeDaRejeicao(carregarJev({ claudeHome: instalar("throw new RangeError('quebrado');") }))) === "RangeError", "R1: módulo que lança ao carregar → rejeita com o name dele");
    afirmar((await nomeDaRejeicao(carregarJev({ claudeHome: instalar("module.exports = { MAX_ESTADO: 10 };") }))) === "ClienteForaDoContrato", "R1: sem decidir → rejeita ClienteForaDoContrato");
    afirmar((await nomeDaRejeicao(carregarJev({ claudeHome: instalar("module.exports = { decidir: async () => ({}) };") }))) === "ClienteForaDoContrato", "R1: sem MAX_ESTADO → rejeita ClienteForaDoContrato");

    // Ponta a ponta com classificar: ausente e quebrado saem com motivos distintos, os dois sensíveis.
    const ausente = await classificar({ texto: "t", carregar: () => carregarJev({ claudeHome: join(raiz, "vazia") }), optIn: true });
    afirmar(CATEGORIAS.every((c) => ausente.jev[c].motivo === "cliente do Jev não encontrado"), "classificar: jev.js ausente → cliente do Jev não encontrado");
    // O cenário do achado 7: um package.json com "type":"module" acima da CLAUDE_HOME faz o jev.js ser
    // lido como ESM, e `module.exports` não existe. O createRequire não evita isso (o import() também
    // falhava); o que muda é a mensagem, que agora diz que o arquivo está lá e não carregou.
    const escopoEsm = join(raiz, "escopo-esm");
    mkdirSync(join(escopoEsm, "casa", "hooks"), { recursive: true });
    writeFileSync(join(escopoEsm, "package.json"), '{"type":"module"}\n');
    writeFileSync(join(escopoEsm, "casa", "hooks", "jev.js"), "module.exports = { MAX_ESTADO: 10, decidir: async () => ({}) };\n");
    const esm = await classificar({ texto: "t", carregar: () => carregarJev({ claudeHome: join(escopoEsm, "casa") }), optIn: true });
    afirmar(CATEGORIAS.every((c) => /^falhou ao carregar o cliente \(\w+\)$/.test(esm.jev[c].motivo)), `classificar: jev.js lido como ESM → falhou ao carregar (${esm.jev.dado.motivo})`);

    // R1 + origem: o caminho vem da CLAUDE_HOME dada, e o `cliente` da saída é ele.
    const casaOk = instalar(respostaFalsa({ estado: "ok", tipo: "noul", sim: false, probabilidade: 0.05 }));
    const jev = await carregarJev({ claudeHome: casaOk });
    afirmar(jev?.origem === join(casaOk, "hooks", "jev.js"), "R1: origem é o hooks/jev.js da instalação");

    // R2: a pergunta vai por `decidir`, com o texto inteiro como estado e o uso `spec`; P(sim) vira sim/nao.
    const resposta = await jev.perguntar("A spec toca dado?", "texto da spec");
    afirmar(resposta.estado === "ok" && resposta.resposta === "nao" && Math.abs(resposta.confianca - 0.95) < 1e-9, "R2: P(sim) = 0,05 → nao com confiança 0,95");
    const chamadasDoOk = globalThis.__chamadasJev[join(casaOk, "hooks")];
    const chamada = chamadasDoOk[0];
    afirmar(chamada.estado === "texto da spec" && chamada.opcoes.uso === "spec", "o texto vai inteiro como estado, com o uso spec");
    afirmar(igual(chamada.perguntas, { sensivel: { tipo: "noul", instrucao: "A spec toca dado?" } }), "a pergunta é uma noul com a instrução dada");
    afirmar(chamada.opcoes.timeoutMs === 20000, "orçamento: timeoutMs = ORCAMENTO_MS");

    const comP = async (probabilidade) => (await carregarJev({ claudeHome: instalar(respostaFalsa({ estado: "ok", tipo: "noul", sim: probabilidade >= 0.5, probabilidade })) })).perguntar("p", "t");
    const casos = [[0.5, "sim", 0.5], [0.7, "sim", 0.7], [0.3, "nao", 0.7], [0, "nao", 1], [1, "sim", 1]];
    for (const [p, esperada, confianca] of casos) {
      const r = await comP(p);
      afirmar(r.resposta === esperada && Math.abs(r.confianca - confianca) < 1e-9, `R2: P(sim) = ${p} → ${esperada}, confiança ${confianca}`);
    }

    // Indisponível mantém o motivo do cliente (e o detalhe, que o contrato garante sem segredo).
    const semChave = await (await carregarJev({ claudeHome: instalar(respostaFalsa({ estado: "indisponivel", motivo: "sem_chave" })) })).perguntar("p", "t");
    afirmar(igual(semChave, { estado: "indisponivel", motivo: "sem_chave" }), "indisponível do cliente → o motivo dele");
    const http = await (await carregarJev({ claudeHome: instalar(respostaFalsa({ estado: "indisponivel", motivo: "http", detalhe: "429" })) })).perguntar("p", "t");
    afirmar(igual(http, { estado: "indisponivel", motivo: "http (429)" }), "indisponível com detalhe → motivo (detalhe)");

    // Resposta fora do contrato nunca vira "nao" por acidente.
    for (const [rotulo, ruim] of [["probabilidade NaN", { estado: "ok", tipo: "noul", probabilidade: NaN }], ["probabilidade 1,5", { estado: "ok", tipo: "noul", probabilidade: 1.5 }], ["tipo escolha", { estado: "ok", tipo: "escolha", probabilidade: 0.1 }], ["ausente", undefined]]) {
      const r = await (await carregarJev({ claudeHome: instalar(respostaFalsa(ruim)) })).perguntar("p", "t");
      afirmar(r.estado === "indisponivel" && r.motivo === "resposta inválida", `resposta fora do contrato (${rotulo}) → resposta inválida`);
    }

    // R4: cabe mede o JSON.stringify do texto contra MAX_ESTADO (50 no falso); as aspas contam.
    afirmar(jev.cabe("x".repeat(48)) === true && jev.cabe("x".repeat(49)) === false, "R4: cabe conta o texto com as aspas do JSON");
    afirmar(jev.cabe("\n".repeat(24)) === true && jev.cabe("\n".repeat(25)) === false, "R4: cabe conta o escape de cada quebra de linha");

    // Ponta a ponta com classificar: spec grande não pergunta; spec pequena passa pelas quatro.
    const grande = await classificar({ texto: "x".repeat(60), carregar: () => carregarJev({ claudeHome: casaOk }) });
    afirmar(CATEGORIAS.every((c) => grande.jev[c].motivo === "spec maior que o limite do cliente") && grande.cliente === join(casaOk, "hooks", "jev.js"), "classificar: spec acima do MAX_ESTADO → maior que o limite, sem perguntar");
    chamadasDoOk.length = 0;
    const pequena = await classificar({ texto: "spec curta", carregar: () => carregarJev({ claudeHome: casaOk }) });
    afirmar(CATEGORIAS.every((c) => igual(pequena.jev[c], nao(0.95))) && chamadasDoOk.length === 4, "classificar: spec que cabe → quatro perguntas, quatro nao 0,95");
  } finally {
    delete globalThis.__chamadasJev;
    rmSync(raiz, { recursive: true, force: true });
  }
}

console.log("estático: um cliente só, sem rede nem processo (CA6)");
{
  const fonte = readFileSync(caminhoModulo, "utf8");
  const proibido = /fetch\s*\(|XMLHttpRequest|WebSocket|undici|["'](node:)?(http|https|http2|net|tls|dgram|child_process)["']/;
  afirmar(!proibido.test(fonte), "o fonte não casa rede nem child_process");

  // Carregar código (`import(` dinâmico, `require(`, `createRequire(`) só dentro de carregarJev: a
  // posição de cada um tem de cair no corpo dela.
  const inicio = fonte.indexOf("export async function carregarJev");
  const fim = fonte.indexOf("\n}\n", inicio);
  // Os comentários de linha viram espaços (mesmo tamanho, as posições não mudam): citar o contrato num
  // comentário não é carregar código.
  const semComentarios = fonte.replace(/^(\s*)\/\/.*$/gm, (linha) => " ".repeat(linha.length));
  const posicoes = [...semComentarios.matchAll(/\bimport\s*\(|\brequire\s*\(|\bcreateRequire\s*\(/g)].map((x) => x.index);
  afirmar(inicio !== -1 && fim !== -1, "carregarJev existe no fonte");
  afirmar(posicoes.length > 0 && posicoes.every((p) => p > inicio && p < fim), `todo carregamento de código está em carregarJev (${posicoes.length} encontrado(s))`);
  afirmar(fonte.includes("createRequire(import.meta.url)(caminho)"), "o cliente é carregado com createRequire(import.meta.url)(caminho), como no contrato do #42");
}

console.log("strings: deploy nas listas de categorias da Fase 4 e dos docs (CA7)");
{
  const raizRepo = join(aqui, "..");
  const ler = (relativo) => readFileSync(join(raizRepo, relativo), "utf8");
  const fase4 = ler("skills/gm-spec/SKILL.md");
  const doc = ler("docs/esteira-gm.md");
  // O template quebra a linha no meio da lista: normaliza os espaços antes de procurar.
  const template = ler("templates/CLAUDE.example.md").replace(/\s+/g, " ");
  afirmar(fase4.includes("data, faturamento, deploy, migration"), "a Fase 4 lista as quatro categorias");
  afirmar(doc.includes("dado, faturamento, deploy ou migration"), "docs/esteira-gm.md lista as quatro categorias");
  afirmar(template.includes("(dado, faturamento, deploy, migration)"), "o template lista as quatro categorias");
  for (const [nome, texto] of [["a Fase 4", fase4], ["docs/esteira-gm.md", doc], ["o template", template]]) {
    for (const velha of ["data, faturamento rules or migrations", "(data, faturamento, migration)", "(dado, faturamento, migration)"]) {
      afirmar(!texto.includes(velha), `${nome} não tem mais a lista de três: ${velha}`);
    }
  }
}

console.log(falhas === 0 ? "\ntudo certo" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);

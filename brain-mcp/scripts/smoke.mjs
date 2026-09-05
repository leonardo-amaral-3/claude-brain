// Smoke test: sobe o servidor por stdio e exercita initialize + tools/list + tools/call.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, [join(root, "dist", "index.js")], {
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      /* ignora linhas não-JSON */
    }
  }
});

let nextId = 1;
function request(method, params) {
  const id = nextId++;
  return new Promise((resolveP, rejectP) => {
    pending.set(id, resolveP);
    setTimeout(() => rejectP(new Error(`timeout em ${method}`)), 90000);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function fail(msg) {
  console.error("FALHOU: " + msg);
  child.kill();
  process.exit(1);
}

const init = await request("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "smoke", version: "0" },
});
if (!init.result?.serverInfo?.name) fail("initialize sem serverInfo");
console.log("initialize OK:", init.result.serverInfo.name, "| instructions:", !!init.result.instructions);
notify("notifications/initialized", {});

const list = await request("tools/list", {});
const names = (list.result?.tools ?? []).map((t) => t.name).sort();
console.log("tools:", names.join(", "));
const expected = ["feature_timeline", "lembrar", "list_features", "read_doc", "recent_activity", "reindex", "search_context", "vizinhanca"];
for (const e of expected) if (!names.includes(e)) fail(`tool ausente: ${e}`);

const search = await request("tools/call", {
  name: "search_context",
  arguments: { query: "subfaturamento", limit: 5 },
});
const searchText = search.result?.content?.[0]?.text ?? "";
console.log("\n--- search_context('subfaturamento') ---\n" + searchText.slice(0, 900));
if (search.result?.isError || !searchText || searchText.startsWith("Nenhum resultado")) {
  fail("search_context sem resultados para 'subfaturamento'");
}

const tl = await request("tools/call", {
  name: "feature_timeline",
  arguments: { feature: "motor-lancamentos-automaticos" },
});
const tlText = tl.result?.content?.[0]?.text ?? "";
console.log("\n--- feature_timeline('motor-lancamentos-automaticos') ---\n" + tlText.slice(0, 900));
if (!tlText.includes("Documentos:")) fail("feature_timeline sem documentos");

const feats = await request("tools/call", { name: "list_features", arguments: {} });
const featsText = feats.result?.content?.[0]?.text ?? "";
const nFeats = featsText.split("\n").filter((l) => l.startsWith("- ")).length;
console.log(`\nlist_features OK: ${nFeats} features`);
if (nFeats < 5) fail("list_features com poucas features");

const code = await request("tools/call", {
  name: "search_context",
  arguments: { query: "GUARDA_CHUVA_PERCENTUAIS", source: "code", limit: 3 },
});
const codeText = code.result?.content?.[0]?.text ?? "";
console.log("\n--- search_context code ---\n" + codeText.slice(0, 500));

const gh = await request("tools/call", {
  name: "search_context",
  arguments: { query: "porta unica designacao", source: "github", limit: 3 },
});
console.log("\n--- search_context github ---\n" + (gh.result?.content?.[0]?.text ?? "").slice(0, 600));

const viz = await request("tools/call", { name: "vizinhanca", arguments: { alvo: "1072" } });
const vizText = viz.result?.content?.[0]?.text ?? "";
console.log("\n--- vizinhanca(1072) ---\n" + vizText.slice(0, 900));
if (!vizText.includes("implementa") && !vizText.includes("toca")) fail("vizinhanca sem arestas para o card 1072");

const semantica = await request("tools/call", {
  name: "search_context",
  arguments: { query: "por que a AIH consolidada aparece duas vezes na tela?", limit: 3 },
});
const semText = semantica.result?.content?.[0]?.text ?? "";
console.log("\n--- busca em linguagem natural ---\n" + semText.slice(0, 700));
if (semText.startsWith("Nenhum resultado")) fail("busca em linguagem natural sem resultados");

const recent = await request("tools/call", {
  name: "recent_activity",
  arguments: { dias: 14 },
});
const recentText = recent.result?.content?.[0]?.text ?? "";
console.log("\n--- recent_activity(14) ---\n" + recentText.slice(0, 1400));
if (!recentText.includes("GitHub")) fail("recent_activity sem seção GitHub");

console.log("\nSMOKE OK");
child.kill();
process.exit(0);

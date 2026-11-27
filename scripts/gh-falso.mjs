#!/usr/bin/env node
// `gh` falso do teste do /gm-frente (scripts/gm-frente-teste.mjs). Nunca chama a rede.
// O teste cria um shim executável chamado `gh` (na pasta temporária, à frente do PATH) que roda este arquivo.
//
// Estado: a pasta $FALSO_DIR, escrita pelo teste e alterada por este arquivo e pelo claude-falso.mjs:
//   config.json              {owner, repo, origin, projeto, bloqueado: {"<n>": "texto"}}   (só leitura)
//   issues.json              {"<n>": {number, title, state, labels: [nomes], body, parent, subs: [n]}} (só leitura)
//   comentarios/<n>.json     [{id, body}]                                                   (mutável)
//   prs/<pr>.json            {number, state, url, headRefName, baseRefName, mergedAt}       (mutável)
//   checks/<pr>.json         [{bucket}]   (ausente → "no checks reported")                  (só leitura)
//   gh-chamadas.log          uma linha JSON por chamada
//
// A superfície é exatamente a que o frente.mjs usa:
//   issue view <n> --repo R --json …
//   api repos/R/issues/<n>/sub_issues | /parent | /comments
//   api -X PATCH repos/R/issues/comments/<id> -F body=@arquivo
//   api graphql -f query=…   (projectItems / ids da base e da issue / createLinkedBranch)
//   pr list --repo R --head B --state all --json …
//   pr checks <pr> --repo R --json bucket
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const dir = process.env.FALSO_DIR;
if (!dir) {
  console.error("gh-falso: FALSO_DIR ausente");
  process.exit(2);
}
const args = process.argv.slice(2);
appendFileSync(join(dir, "gh-chamadas.log"), JSON.stringify(args) + "\n");

const lerJson = (nome, padrao) => (existsSync(join(dir, nome)) ? JSON.parse(readFileSync(join(dir, nome), "utf8")) : padrao);
const config = lerJson("config.json", {});
const issues = lerJson("issues.json", {});
const saida = (obj) => {
  process.stdout.write(JSON.stringify(obj) + "\n");
  process.exit(0);
};
const falha = (msg, codigo = 1) => {
  process.stderr.write(msg + "\n");
  process.exit(codigo);
};
const valorDe = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

function comentarios(n) {
  return lerJson(join("comentarios", `${n}.json`), []);
}
function prs() {
  const pasta = join(dir, "prs");
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(pasta, f), "utf8")));
}
const issue = (n) => issues[String(n)] || falha(`gh-falso: issue ${n} não existe (HTTP 404)`);

const [cmd, sub] = args;

if (cmd === "issue" && sub === "view") {
  const i = issue(args[2]);
  saida({ number: i.number, title: i.title, state: i.state, body: i.body || "", labels: (i.labels || []).map((name) => ({ name })) });
}

if (cmd === "pr" && sub === "list") {
  const head = valorDe("--head");
  saida(prs().filter((p) => !head || p.headRefName === head).sort((a, b) => a.number - b.number));
}

if (cmd === "pr" && sub === "checks") {
  const f = join(dir, "checks", `${args[2]}.json`);
  if (!existsSync(f)) falha("no checks reported on the 'x' branch");
  saida(JSON.parse(readFileSync(f, "utf8")));
}

if (cmd === "api") {
  const metodo = valorDe("-X") || "GET";
  const alvo = args.find((a, k) => k > 0 && !a.startsWith("-") && args[k - 1] !== "-X" && args[k - 1] !== "-F" && args[k - 1] !== "-f");

  if (alvo === "graphql") {
    const q = valorDe("-f") && valorDe("-f").startsWith("query=") ? valorDe("-f").slice(6) : args.find((a) => a.startsWith("query="))?.slice(6) || "";
    const numero = /issue\(number:\s*(\d+)\)/.exec(q)?.[1];
    if (q.includes("createLinkedBranch")) {
      const nome = /name:\s*"([^"]+)"/.exec(q)?.[1];
      const oid = /oid:\s*"([^"]+)"/.exec(q)?.[1];
      const r = spawnSync("git", ["--git-dir", config.origin, "branch", nome, oid], { encoding: "utf8" });
      if (r.status !== 0) falha(`gh-falso: createLinkedBranch falhou: ${r.stderr}`);
      saida({ data: { createLinkedBranch: { linkedBranch: { ref: { name: nome } } } } });
    }
    if (q.includes("qualifiedName")) {
      const ref = /qualifiedName:\s*"([^"]+)"/.exec(q)?.[1];
      const r = spawnSync("git", ["--git-dir", config.origin, "rev-parse", ref], { encoding: "utf8" });
      if (r.status !== 0) falha(`gh-falso: ref ${ref} não existe na origin`);
      saida({ data: { repository: { id: "R_falso", issue: { id: `I_${numero}` }, ref: { target: { oid: r.stdout.trim() } } } } });
    }
    if (q.includes("projectItems")) {
      issue(numero);
      const texto = (config.bloqueado || {})[numero];
      saida({
        data: { repository: { issue: { projectItems: { nodes: [{ project: { number: config.projeto }, fieldValueByName: texto ? { text: texto } : null }] } } } },
      });
    }
    falha("gh-falso: graphql que o frente.mjs não usa");
  }

  const m = /^repos\/[^/]+\/[^/]+\/issues\/(\d+)\/(sub_issues|parent|comments)$/.exec(alvo || "");
  if (m && metodo === "GET") {
    const i = issue(m[1]);
    if (m[2] === "sub_issues") saida((i.subs || []).map((n) => ({ number: n, state: issue(n).state, title: issue(n).title })));
    if (m[2] === "parent") {
      if (!i.parent) falha("gh: Not Found (HTTP 404)");
      saida({ number: i.parent });
    }
    saida(comentarios(m[1]));
  }

  const p = /^repos\/[^/]+\/[^/]+\/issues\/comments\/(\d+)$/.exec(alvo || "");
  if (p && metodo === "PATCH") {
    const campo = valorDe("-F") || valorDe("-f") || "";
    const corpo = campo.startsWith("body=@") ? readFileSync(campo.slice(6), "utf8") : campo.replace(/^body=/, "");
    for (const n of Object.keys(issues)) {
      const lista = comentarios(n);
      const c = lista.find((x) => String(x.id) === p[1]);
      if (c) {
        c.body = corpo;
        writeFileSync(join(dir, "comentarios", `${n}.json`), JSON.stringify(lista));
        saida({ id: c.id });
      }
    }
    falha(`gh-falso: comentário ${p[1]} não existe (HTTP 404)`);
  }
}

falha(`gh-falso: comando fora da superfície do frente.mjs: ${args.join(" ")}`, 3);

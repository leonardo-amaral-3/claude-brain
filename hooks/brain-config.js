// Config compartilhada dos hooks: quais workspaces existem e onde fica o indice do brain.
//
// Um arquivo so, porque o hook de briefing e o de diario precisam da MESMA lista de workspaces.
// Enquanto ela morava duplicada dentro dos dois, trocar de maquina (ou acrescentar um workspace)
// significava lembrar de editar os dois — e esquecer um deles falha em silencio, que e o pior
// modo de falhar que um hook tem.
//
// Formato de ~/.claude/brain-workspaces.json:
//   {
//     "db": "${HOME}/notoria/claude/brain-mcp/data/brain.db",
//     "workspaces": [
//       { "nome": "notoria", "prefixo": "${HOME}/notoria", "exceto": ["operations-center"] },
//       { "nome": "pessoal", "prefixo": "${HOME}/pessoal", "repos": ["operations-center"] }
//     ]
//   }
//
// `repos` lista os repos do workspace; `exceto` = todos os outros. Serve para filtrar as fontes
// (github, git) cujo caminho no indice nao diz a que workspace pertencem.
const fs = require('fs');
const os = require('os');
const path = require('path');

const BS = String.fromCharCode(92);
const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const ARQUIVO = process.env.BRAIN_WORKSPACES || path.join(CLAUDE_HOME, 'brain-workspaces.json');

const barras = (p) => String(p == null ? '' : p).split(BS).join('/');

function expandir(valor) {
  return String(valor).replace(/\$\{(\w+)\}/g, (_, nome) => {
    if (nome === 'HOME') return barras(os.homedir());
    if (nome === 'CLAUDE_HOME') return barras(CLAUDE_HOME);
    return barras(process.env[nome] || '');
  });
}

/** Config inteira, ou null se nao houver arquivo. Hook sem config nao faz nada — de proposito. */
function carregar() {
  try {
    const c = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
    const workspaces = (c.workspaces || []).map((w) =>
      Object.assign({}, w, { prefixo: expandir(w.prefixo) })
    );
    if (!workspaces.length) return null;
    return { db: c.db ? expandir(c.db) : null, workspaces };
  } catch {
    return null;
  }
}

/** O workspace que contem este cwd (com `db` junto), ou null se o cwd estiver fora de todos. */
function doCwd(cwd) {
  const c = carregar();
  if (!c) return null;
  const alvo = barras(cwd).toLowerCase();
  const ws = c.workspaces.find((w) => alvo.startsWith(w.prefixo.toLowerCase()));
  return ws ? Object.assign({}, ws, { db: c.db }) : null;
}

module.exports = { carregar, doCwd, expandir, barras, ARQUIVO };

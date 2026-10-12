#!/usr/bin/env node
// SessionEnd hook: regenera o espelho do grafo do brain no Obsidian (<workspace>/claude/grafo/).
//
// O gerador leva ~segundos e apaga+reescreve ~8,5 mil notas. Por isso:
//  - roda DETACHED (o SessionEnd cancela trabalho feito dentro do hook — ver obsidian-diario.js);
//  - trava por arquivo: duas rodadas ao mesmo tempo apagariam as notas uma da outra;
//  - no maximo uma rodada a cada INTERVALO, e so se o brain.db mudou desde a ultima;
//  - pula se o Obsidian estiver aberto: reescrever o cofre inteiro com ele aberto foi o que
//    travou a abertura em 16/09. Fica pendente para o proximo fim de sessao.
// Log em ~/.claude/grafo-espelho.log.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const ESTADO = path.join(CLAUDE_HOME, 'grafo-espelho.json');
const TRAVA = path.join(CLAUDE_HOME, 'grafo-espelho.lock');
const LOG = path.join(CLAUDE_HOME, 'grafo-espelho.log');
const INTERVALO_MS = 30 * 60 * 1000;
const TRAVA_VELHA_MS = 10 * 60 * 1000;

const log = (msg) => {
  try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`); } catch {}
};
const lerEstado = () => {
  try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')); } catch { return {}; }
};

if (process.argv[2] === '--rodar') rodar(process.argv[3]);
else hook();

function hook() {
  if (process.env.DIARIO_HOOK) process.exit(0); // claude -p filho do diario
  let input = '';
  process.stdin.on('data', (d) => (input += d));
  process.stdin.on('end', () => {
    try { disparar(JSON.parse(input || '{}')); } catch (e) { log(`erro no hook: ${e.message}`); }
    process.exit(0);
  });
}

function disparar(h) {
  const ws = require('./brain-config.js').doCwd(h.cwd || '');
  if (!ws) return;
  const gerador = path.join(ws.prefixo, 'claude', 'grafo', '_gerador', 'gerar-grafo.mjs');
  if (!fs.existsSync(gerador)) return;

  const estado = lerEstado();
  if (Date.now() - (estado.ultimo || 0) < INTERVALO_MS) return;
  try {
    if (ws.db && fs.statSync(ws.db).mtimeMs <= (estado.ultimo || 0)) return; // nada novo no brain
  } catch {}

  try {
    fs.writeFileSync(TRAVA, String(process.pid), { flag: 'wx' });
  } catch {
    try {
      if (Date.now() - fs.statSync(TRAVA).mtimeMs < TRAVA_VELHA_MS) return; // outra rodada em curso
      fs.writeFileSync(TRAVA, String(process.pid));
    } catch { return; }
  }

  const filho = cp.spawn(process.execPath, [__filename, '--rodar', gerador], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  filho.unref();
}

function rodar(gerador) {
  try {
    if (obsidianAberto()) { log('pulou: Obsidian aberto'); return; }
    const r = cp.spawnSync(process.execPath, [gerador], {
      cwd: path.dirname(gerador), encoding: 'utf8', windowsHide: true, timeout: 5 * 60 * 1000,
    });
    if (r.status === 0) {
      fs.writeFileSync(ESTADO, JSON.stringify({ ultimo: Date.now() }));
      const resumo = (r.stdout || '').split('\n').filter((l) => /entidades|escritas/.test(l)).join(' | ');
      log(`ok: ${resumo}`);
    } else {
      log(`falhou (status ${r.status}): ${(r.stderr || r.error || '').toString().slice(0, 500)}`);
    }
  } finally {
    try { fs.unlinkSync(TRAVA); } catch {}
  }
}

function obsidianAberto() {
  if (process.platform !== 'win32') {
    return cp.spawnSync('pgrep', ['-x', 'obsidian'], { encoding: 'utf8' }).status === 0;
  }
  const r = cp.spawnSync('tasklist', ['/FI', 'IMAGENAME eq Obsidian.exe', '/NH'], {
    encoding: 'utf8', windowsHide: true,
  });
  return /obsidian\.exe/i.test(r.stdout || '');
}

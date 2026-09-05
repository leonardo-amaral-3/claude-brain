#!/usr/bin/env node
// SessionStart hook: injeta um briefing curto do cerebro (brain-mcp) no inicio da sessao.
// Objetivo duplo: situar a sessao e deixar o cerebro na frente do modelo desde o primeiro turno.
// Falha sempre em silencio - hook de contexto nunca pode atrapalhar o boot.
//
// O indice e compartilhado entre workspaces, entao o briefing e filtrado pelo workspace do cwd:
//  - docs comuns (planning/docs/diario/decisao) -> filtro por prefixo de path
//  - docs de github/git -> moram todos sob <brain>/data/, entao filtro por repo
//
// Workspaces e caminho do indice vem de ~/.claude/brain-workspaces.json (ver brain-config.js).
const fs = require('fs');
const path = require('path');
const cfg = require('./brain-config.js');

const BS = String.fromCharCode(92);

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    const h = JSON.parse(input || '{}');
    const cwd = String(h.cwd || '').split(BS).join('/');
    const ws = cfg.doCwd(cwd);
    if (!ws) return;
    if (h.source === 'resume') return; // sessao retomada ja tem o contexto
    if (!ws.db || !fs.existsSync(ws.db)) return;

    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(ws.db, { readOnly: true });

    // Os paths sao gravados pelo indexer com separador do Windows; aceita os dois por seguranca.
    const pref = ws.prefixo.split('/').join(BS) + BS + '%';
    const pref2 = ws.prefixo + '/%';
    // Filtro por repo para as fontes cujo path nao diz a que workspace pertencem.
    const lista = ws.repos || ws.exceto;
    const marks = lista.map(() => '?').join(',');
    const repoSQL = ws.repos ? `AND repo IN (${marks})` : `AND (repo IS NULL OR repo NOT IN (${marks}))`;

    const dias = 10;
    const corte = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    const linhas = [];

    const push = (titulo, rows, fmt) => {
      if (!rows.length) return;
      linhas.push('', titulo);
      for (const r of rows) linhas.push('  ' + fmt(r));
    };

    // Decisoes primeiro: e o que muda o que se pode fazer, nao so o que mudou.
    push(
      'Decisoes registradas:',
      db.prepare(
        "SELECT title, data FROM docs WHERE source='decisao' AND data >= ? " +
          'AND (path LIKE ? OR path LIKE ?) ORDER BY data DESC LIMIT 6'
      ).all(corte, pref, pref2),
      (r) => `${r.data} — ${r.title.slice(0, 110)}`
    );

    push(
      'GitHub em movimento:',
      db.prepare(
        "SELECT title, status, repo FROM docs WHERE source='github' AND data >= ? " +
          `AND status IN ('OPEN','MERGED') ${repoSQL} ORDER BY data DESC LIMIT 6`
      ).all(corte, ...lista),
      (r) => `[${r.status}] ${r.title.slice(0, 110)}`
    );

    push(
      'Ultimas sessoes (diario):',
      db.prepare(
        "SELECT title, data FROM docs WHERE source='diario' " +
          'AND (path LIKE ? OR path LIKE ?) ORDER BY data DESC LIMIT 4'
      ).all(pref, pref2),
      (r) => `${r.data} — ${r.title.slice(0, 100)}`
    );

    push(
      'Specs/docs mexidos:',
      db.prepare(
        "SELECT title, doc_type, feature FROM docs WHERE source IN ('planning','docs') AND data >= ? " +
          'AND (path LIKE ? OR path LIKE ?) ORDER BY data DESC LIMIT 5'
      ).all(corte, pref, pref2),
      (r) => `[${r.doc_type}] ${r.title.slice(0, 100)}`
    );

    const tot = db.prepare('SELECT COUNT(*) n FROM docs').get().n;
    if (!linhas.length) return;

    const texto =
      `Briefing do cerebro (MCP \`brain\`, workspace ${ws.nome}, ${tot} documentos no indice, ultimos ${dias} dias):` +
      linhas.join('\n') +
      '\n\nUse `mcp__brain__search_context` antes de explorar arquivos na mao; ' +
      '`mcp__brain__recent_activity` da o quadro completo; `mcp__brain__feature_timeline` conta a historia de uma feature.';

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texto },
      })
    );
  } catch {
    /* silencio proposital */
  }
});

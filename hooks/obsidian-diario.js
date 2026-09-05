#!/usr/bin/env node
// SessionEnd hook: nota da sessao no cofre Obsidian.
// Nome = data + titulo; session_id no frontmatter e a chave (o nome pode mudar).
//
// REGRA DE OURO: este hook grava a nota em milissegundos e sai. O SessionEnd roda
// enquanto a CLI esta desligando, entao trabalho de rede feito AQUI DENTRO e
// cancelado antes de terminar ("Hook cancelled") e a nota se perde inteira — foi
// exatamente isso que impediu o hook de funcionar durante meses.
// O resumo de verdade (skill /diario, ~30s) fica com obsidian-diario-titulo.js,
// disparado detached+unref: ele sobrevive ao fim da CLI.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const BS = String.fromCharCode(92);
const EM_ANDAMENTO = '- _Resumo automático em andamento…_\n';
if (process.env.DIARIO_HOOK) process.exit(0); // trava anti-recursao (claude -p filho)
let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try { principal(); } catch (e) { if (process.env.DIARIO_DEBUG) console.error(e); }
  process.exit(0);
});

function principal() {
  const h = JSON.parse(input || '{}');
  const cwd = String(h.cwd || '').split(BS).join('/');
  // Um cofre por workspace: o diario da sessao vai para o vault do projeto em que ela rodou.
  // A lista vem de ~/.claude/brain-workspaces.json — cwd fora de todos, nao grava nada.
  const ws = require('./brain-config.js').doCwd(cwd);
  if (!ws) return;
  const tp = h.transcript_path;
  if (!tp || !fs.existsSync(tp)) return;

  const FILTRO = /<command-name>|<command-message>|Base directory for this skill|<local-command-stdout>|local-command-caveat|<task-notification>|^Caveat:|<system-reminder>|SYSTEM NOTIFICATION/;
  const lines = fs.readFileSync(tp, 'utf8').split('\n').filter(Boolean);
  const msgs = []; let assistants = 0;
  for (const l of lines) {
    let j; try { j = JSON.parse(l); } catch { continue; }
    if (j.isSidechain) continue;
    if (j.type === 'assistant') assistants++;
    if (j.type !== 'user') continue;
    const c = j.message && j.message.content;
    let txt = '';
    if (typeof c === 'string') txt = c;
    else if (Array.isArray(c)) txt = c.filter(b => b && b.type === 'text').map(b => b.text).join(' ');
    if (!txt || FILTRO.test(txt)) continue;
    msgs.push(txt.split('\n').join(' ').trim().slice(0, 220));
  }
  if (msgs.length < 1 || assistants < 2) return;
  // Sub-sessao do fallback barato (claude -p --model haiku): tem transcript no projeto
  // e viraria nota-lixo num backfill. Em execucao normal DIARIO_HOOK ja barra.
  if (msgs[0].startsWith('Sessao de trabalho de programacao. O usuario disse:')) return;
  // Fork criado pelo enriquecedor para rodar /diario: copia o historico inteiro e viraria
  // nota duplicada num backfill. Ele apaga o proprio transcript, isto e o cinto de seguranca.
  // (so o prompt do fork casa: mensagem que COMECA com /diario e traz a marca. Conferir
  //  apenas includes barraria qualquer sessao em que a marca foi citada — esta, inclusive.)
  if (msgs.some(m => m.startsWith('/diario') && m.includes('[diario-auto]'))) return;
  const primeira = msgs[0].slice(0, 180);

  const sid = String(h.session_id || 'sem-id');
  const now = new Date(), pad = n => String(n).padStart(2, '0');
  const dia = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const hora = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const dir = ws.prefixo + '/claude/diario';
  fs.mkdirSync(dir, { recursive: true });

  // nota existente? (match por session_id no frontmatter)
  let notePath = null, conteudo = null;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md') || f === 'index.md') continue;
    const alvo = path.join(dir, f);
    const cur = fs.readFileSync(alvo, 'utf8');
    if (cur.slice(0, 400).includes('session_id: ' + sid)) { notePath = alvo; conteudo = cur; break; }
  }

  // So enriquece o que ainda esta cru: nota ja resumida (pelo automatico ou pelo
  // /diario na mao) nao gasta uma nova rodada, e nao fica presa em "em andamento".
  const enriquecer = !notePath || conteudo.includes('_(pendente');
  const auto = '<!-- auto:inicio -->\n- **Atualizado:** ' + dia + ' ' + hora + ' · ' + msgs.length + ' mensagens do usuário\n- **Primeira mensagem:** ' + primeira + '\n- **Retomar:** `claude --resume ' + sid + '` (em `' + cwd + '`)\n' + (enriquecer ? EM_ANDAMENTO : '') + '<!-- auto:fim -->\n';

  if (notePath) {
    if (conteudo.includes('<!-- auto:inicio -->')) {
      fs.writeFileSync(notePath, conteudo.replace(/<!-- auto:inicio -->[^]*?<!-- auto:fim -->\n?/, auto));
    }
  } else {
    // Titulo provisorio: slug da 1a mensagem. O enriquecedor troca por um titulo de
    // verdade; se ele morrer, a nota fica com este e nada se perde.
    const titulo = primeira.replace(/[^A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF ]/g, ' ').split(' ').filter(Boolean).slice(0, 7).join(' ').slice(0, 60).trim()
      || 'sessao ' + sid.slice(0, 8);
    const nome = dia + ' ' + titulo;
    notePath = path.join(dir, nome + '.md');
    let extra = 1;
    while (fs.existsSync(notePath)) { notePath = path.join(dir, nome + ' ' + (++extra) + '.md'); }
    const resumo = primeira.split('"').join("'").slice(0, 140);
    const front = '---\ndata: ' + dia + '\nprojeto: ' + (cwd.split('/').filter(Boolean).pop() || '') + '\nsession_id: ' + sid + '\nresumo: "' + resumo + '"\ntags:\n  - claude-sessao\n---\n';
    fs.writeFileSync(notePath, front + auto + '\n## Resumo\n_(pendente — enriquecimento automático)_\n');
    // index.md nao lista mais sessao a sessao: Sessoes.base monta a tabela pelo frontmatter.
  }

  if (!enriquecer) return;
  const enriquecedor = path.join(__dirname, 'obsidian-diario-titulo.js');
  if (!fs.existsSync(enriquecedor)) return;
  const pedido = path.join(os.tmpdir(), 'diario-' + sid + '.json');
  fs.writeFileSync(pedido, JSON.stringify({
    nota: notePath, dir: dir, dia: dia, sid: sid, cwd: cwd, tp: tp,
    material: msgs.slice(0, 6).map((m, i) => (i + 1) + '. ' + m).join('\n')
  }));
  const filho = cp.spawn(process.execPath, [enriquecedor, pedido], {
    detached: true, stdio: 'ignore', windowsHide: true,
    env: Object.assign({}, process.env, { DIARIO_HOOK: '1' })
  });
  filho.unref();
}

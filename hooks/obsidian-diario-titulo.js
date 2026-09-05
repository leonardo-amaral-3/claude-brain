#!/usr/bin/env node
// Enriquecedor do diario, disparado pelo SessionEnd hook com detached+unref.
//
// Roda FORA do ciclo de vida da CLI: retoma a sessao que acabou (--resume
// --fork-session) e executa a skill /diario nela, que e exatamente o que o
// usuario fazia na mao. Isso nao cabe dentro do hook — leva ~40-70s e seria
// cancelado no desligamento ("Hook cancelled"), como acontecia antes.
//
// Garantias:
//  - a nota JA existe quando este processo comeca (o hook gravou em 0,15s);
//    se aqui falhar tudo, a nota so fica com o titulo provisorio.
//  - o fork recebe --session-id nosso, entao o transcript dele e apagado no
//    fim: nao polui o projeto nem vira nota duplicada num backfill.
//  - fallback barato: se o /diario falhar, ainda pedimos TITULO+RESUMO ao haiku.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const MODELO = process.env.DIARIO_MODELO || 'haiku'; // 'sonnet' rende tags/secoes melhores, custa ~2x
const MARCA = '[diario-auto]';                        // o hook pula transcript que contenha isto
const PROJETOS = require('./brain-config.js').expandir('${CLAUDE_HOME}/projects');
const EM_ANDAMENTO = '- _Resumo automático em andamento…_\n';

const pedidoPath = process.argv[2];
let p = null;
try {
  p = JSON.parse(fs.readFileSync(pedidoPath, 'utf8'));
  if (!fs.existsSync(p.nota)) process.exit(0);
  if (rodarDiario()) { marcarLinha(null); }
  else if (tituloBarato()) { marcarLinha('- _Resumo automático falhou — rode `/diario` numa sessão retomada._\n'); }
  else { marcarLinha('- _Resumo automático falhou — rode `/diario` numa sessão retomada._\n'); }
} catch (e) {
  if (process.env.DIARIO_DEBUG) console.error(e);
} finally {
  try { fs.unlinkSync(pedidoPath); } catch {}
}

// Retoma a sessao num fork e roda a skill /diario. true se a nota ficou enriquecida.
function rodarDiario() {
  const forkId = crypto.randomUUID();
  const prompt = '/diario\n\n' + MARCA + ' Sessao retomada automaticamente no fim da sessao para registrar a nota.\n' +
    'O session_id REAL a documentar e ' + p.sid + ' — use esse id para achar a nota pelo frontmatter e no bloco\n' +
    '`claude --resume`, NAO o id desta sessao fork.\n' +
    'O nome do arquivo hoje e PROVISORIO (slug da 1a mensagem, as vezes so "sim" ou "aprovado"): se ele nao\n' +
    'descrever a sessao, renomeie para um titulo de 3 a 6 palavras, conforme o passo 5 da skill.\n' +
    'A data da sessao e ' + p.dia + ': mantenha o campo data: do frontmatter e o prefixo do nome do\n' +
    'arquivo nessa data, NAO na data de hoje (o enriquecimento pode estar rodando dias depois).\n' +
    'Garanta tambem as tags de dominio no frontmatter (alem de claude-sessao) e a secao ## Retomar.\n' +
    'Nao peca confirmacao nem faca perguntas: escreva a nota e responda so com o caminho do arquivo.';
  const cmd = ['claude', '-p', '--resume', p.sid, '--fork-session', '--session-id', forkId,
    '--model', MODELO, '--permission-mode', 'bypassPermissions', '--strict-mcp-config'].join(' ');
  try {
    cp.execSync(cmd, {
      input: prompt, encoding: 'utf8', timeout: 420000, maxBuffer: 64 * 1024 * 1024,
      cwd: cwdDoResume(),
      env: Object.assign({}, process.env, { DIARIO_HOOK: '1' })
    });
  } catch (e) {
    if (process.env.DIARIO_DEBUG) console.error('/diario falhou:', String(e.message).slice(0, 300));
    limparFork(forkId);
    return false;
  }
  limparFork(forkId);
  const nota = acharNota();
  // so conta como sucesso se o "## Resumo" pendente sumiu de fato
  return !!nota && !/_\(pendente/.test(fs.readFileSync(nota, 'utf8'));
}

// Fallback do desenho antigo: TITULO + RESUMO numa chamada curta ao haiku.
function tituloBarato() {
  try {
    const saida = cp.execSync('claude -p --model haiku', {
      input: 'Sessao de trabalho de programacao. O usuario disse:\n' + p.material +
        '\n\nResponda EXATAMENTE duas linhas, em pt-BR, sem aspas e sem barra:\n' +
        'TITULO: <3 a 6 palavras, sem pontuacao>\nRESUMO: <uma frase de ate 140 caracteres dizendo o que a sessao fez ou decidiu>',
      encoding: 'utf8', timeout: 120000, env: Object.assign({}, process.env, { DIARIO_HOOK: '1' })
    });
    let titulo = '', resumo = '';
    for (const l of saida.split('\n')) {
      const mt = l.match(/^\s*TITULO:\s*(.+)$/i); if (mt) titulo = mt[1];
      const mr = l.match(/^\s*RESUMO:\s*(.+)$/i); if (mr) resumo = mr[1];
    }
    titulo = titulo.replace(/[^A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF ]/g, ' ').split(' ').filter(Boolean).join(' ').slice(0, 60).trim();
    resumo = resumo.split('"').join("'").split('\r').join('').trim().slice(0, 160);
    let nota = acharNota(); if (!nota) return false;
    if (resumo) {
      const cur = fs.readFileSync(nota, 'utf8');
      if (/^resumo: .*$/m.test(cur)) fs.writeFileSync(nota, cur.replace(/^resumo: .*$/m, () => 'resumo: "' + resumo + '"'));
    }
    if (titulo) {
      let alvo = path.join(p.dir, p.dia + ' ' + titulo + '.md');
      let n = 1;
      while (alvo !== nota && fs.existsSync(alvo)) { alvo = path.join(p.dir, p.dia + ' ' + titulo + ' ' + (++n) + '.md'); }
      if (alvo !== nota) fs.renameSync(nota, alvo);
    }
    return !!(titulo || resumo);
  } catch (e) { if (process.env.DIARIO_DEBUG) console.error('fallback falhou:', String(e.message).slice(0, 200)); return false; }
}

// A nota pode ter sido renomeada pelo /diario: acha sempre pelo session_id.
function acharNota() {
  for (const f of fs.readdirSync(p.dir)) {
    if (!f.endsWith('.md') || f === 'index.md') continue;
    const alvo = path.join(p.dir, f);
    if (fs.readFileSync(alvo, 'utf8').slice(0, 400).includes('session_id: ' + p.sid)) return alvo;
  }
  return null;
}

// Troca a linha "em andamento" do bloco auto: some no sucesso, vira aviso na falha.
function marcarLinha(substituta) {
  const nota = acharNota(); if (!nota) return;
  const cur = fs.readFileSync(nota, 'utf8');
  if (!cur.includes(EM_ANDAMENTO)) return;
  fs.writeFileSync(nota, cur.replace(EM_ANDAMENTO, substituta || ''));
}

// O fork copia o historico inteiro (~1MB): sem isso ele entulha o projeto e
// viraria nota duplicada se alguem rodar um backfill depois.
function limparFork(forkId) {
  for (const dir of safeLs(PROJETOS)) {
    const f = path.join(PROJETOS, dir, forkId + '.jsonl');
    if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} }
  }
}
function safeLs(d) { try { return fs.readdirSync(d); } catch { return []; } }

// O --resume so enxerga a sessao a partir do diretorio cujo nome codificado bate com a
// pasta do transcript. Nem sempre e o cwd da sessao: uma sessao aberta em notoria/ e
// movida para modulo-processos/ grava em C--Users-lokin-notoria e o resume falharia ali.
// Decodificar o nome da pasta e ambiguo (segmentos tem hifen), entao subimos a arvore
// a partir do cwd e comparamos o nome CODIFICADO de cada ancestral.
function cwdDoResume() {
  const alvo = path.basename(path.dirname(p.tp || ""));
  const codifica = d => d.split(":").join("-").split("/").join("-").split(String.fromCharCode(92)).join("-");
  let d = (p.cwd || "").split(String.fromCharCode(92)).join("/");
  for (let i = 0; i < 12 && d; i++) {
    if (codifica(d) === alvo && fs.existsSync(d)) return d;
    const pai = path.dirname(d);
    if (pai === d) break;
    d = pai;
  }
  return fs.existsSync(p.cwd || "") ? p.cwd : undefined;
}

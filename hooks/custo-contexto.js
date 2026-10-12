#!/usr/bin/env node
// PreToolUse: torna mecânica a Regra 3 do CLAUDE.md (custo de contexto).
//
// POR QUE EXISTE: a Regra 3 é texto, e texto perde. Medido em 2026-09-22 sobre os transcripts
// deste usuário: a Regra 1, escrita com o mesmo cuidado no mesmo arquivo, perde 18:1 para o
// lembrete de bypass permissions, que é injetado a cada turno e chega mais perto da decisão.
// Este hook não persuade — ele NEGA.
//
// O QUE NEGA, e por quê esses dois:
//   1. Bash/PowerShell com corpo de heredoc acima do limiar. Medido: 5.231 chamadas com heredoc
//      carregam 13,9 M chars — 52,2% de TODOS os argumentos de Bash. Argumento é faturado como
//      output (US$ 75/M) E depois relido ~47x pelo resto da sessão.
//   2. Write num arquivo que já existe, com conteúdo acima do limiar. Medido: Write tem argumento
//      médio de 7.956 chars (p90 19.203, máx 132.802) contra 1.271 do Edit — 6x mais caro para
//      a mesma mudança.
//
// FALHA ABERTO, SEMPRE. Um bug aqui não pode travar o trabalho: qualquer exceção, stdin ilegível
// ou JSON quebrado sai em silêncio pelo caminho do "permitido". O preço de um falso-negativo é
// alguns milhares de tokens; o de um falso-positivo é a sessão emperrada.
//
// ESCAPES, quando a negação estiver errada:
//   - Bash: incluir `hook:ok` em qualquer lugar do comando.
//   - Qualquer um: exportar CLAUDE_HOOK_CUSTO=off no ambiente do Claude Code.
//   - Permanente: `/hooks` para desabilitar, ou apagar o bloco em ~/.claude/settings.json.

const fs = require('fs');

const LIMIAR_HEREDOC = 1500; // chars de CORPO; a mediana medida do heredoc é 2.654
const LIMIAR_WRITE = 1500; // chars de conteúdo novo num arquivo que já existe

const permitir = () => process.exit(0);

const negar = (motivo) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: motivo,
      },
    })
  );
  process.exit(0);
};

let bruto = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (bruto += c));
process.stdin.on('error', permitir);
process.stdin.on('end', () => {
  try {
    if (String(process.env.CLAUDE_HOOK_CUSTO || '').toLowerCase() === 'off') return permitir();

    const ev = JSON.parse(bruto);
    const tool = ev && ev.tool_name;
    const input = (ev && ev.tool_input) || {};

    if (tool === 'Bash' || tool === 'PowerShell') {
      const cmd = String(input.command || '');
      if (cmd.includes('hook:ok')) return permitir();

      // Corpo do heredoc = tudo depois da linha do marcador. Cobre <<EOF, <<'EOF', <<-EOF
      // e o here-string do PowerShell (@' ... '@).
      const m = cmd.match(/<<-?\s*["']?[A-Za-z_]\w*["']?|@["']\r?\n/);
      if (!m) return permitir();
      const corpo = cmd.slice(m.index + m[0].length);
      if (corpo.length <= LIMIAR_HEREDOC) return permitir();

      return negar(
        `Regra 3 do CLAUDE.md: heredoc com ${corpo.length} chars de corpo (limiar ${LIMIAR_HEREDOC}). ` +
          `Conteúdo de arquivo dentro de um argumento é faturado como output E relido ~47x pelo resto da sessão — ` +
          `heredocs são 52% de todos os argumentos de Bash aqui.\n` +
          `Em vez disso: arquivo NOVO -> Write; arquivo que EXISTE -> Edit (6x mais barato); ` +
          `conteúdo mecânico -> gerar por script; script descartável -> escrever uma vez e reinvocar com parâmetro.\n` +
          `Se a negação estiver errada, inclua "hook:ok" no comando.`
      );
    }

    if (tool === 'Write') {
      const caminho = String(input.file_path || '');
      const conteudo = String(input.content || '');
      if (!caminho || conteudo.length <= LIMIAR_WRITE) return permitir();
      // Arquivo novo é exatamente o caso em que Write é a ferramenta certa.
      if (!fs.existsSync(caminho)) return permitir();

      return negar(
        `Regra 3 do CLAUDE.md: Write com ${conteudo.length} chars num arquivo que JÁ EXISTE (${caminho}). ` +
          `Medido neste workspace: Write custa 7.956 chars de argumento em média contra 1.271 do Edit, ` +
          `para a mesma mudança — e o argumento é relido ~47x.\n` +
          `Use Edit para trocar só o trecho que muda. Se for realmente uma reescrita inteira, ` +
          `apague o arquivo antes, ou exporte CLAUDE_HOOK_CUSTO=off.`
      );
    }

    return permitir();
  } catch {
    return permitir(); // falha aberto, sempre
  }
});

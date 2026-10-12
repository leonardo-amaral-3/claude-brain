# Convenções comuns das skills `gm-*`

Este arquivo é a **fonte única** dos blocos que toda skill da esteira repete. Cada seção `##` daqui
é um bloco; `node scripts/skills-comum.mjs` o carimba, byte a byte, em toda `skills/gm-*/SKILL.md`
que já tenha o mesmo cabeçalho — a skill entra no bloco escrevendo o cabeçalho, e sai apagando-o.
`node scripts/skills-comum.mjs --check` compara e sai com `1` se alguma cópia divergiu; é a suíte
do `/gm-ship` para mudança em `skills/`, declarada no `CLAUDE.md` deste repo.

Por que carimbar, e não citar nem incluir — medido em 2026-10-12, no workspace do mantenedor: das
480 sessões que invocaram uma `/gm-*`, **nenhuma** leu o `docs/esteira-gm.md` do `claude-brain` que
o bloco citava (as 9 que tocaram no arquivo eram sessões editando as próprias skills); e `@arquivo`
dentro de um `SKILL.md` só expande com caminho absoluto ou relativo ao `cwd` — relativo à pasta da
skill e `~` são descartados **em silêncio**, e expandir não poupa contexto. Regra que a sessão
precisa seguir tem de estar no texto da skill; o que este arquivo garante é que ela seja escrita
uma vez.

As seções abaixo são instruções de skill: ficam em inglês, e o que o humano lê fica em pt-BR, como
nas skills. Seção nova = cabeçalho novo aqui, o mesmo cabeçalho nas skills que a recebem, e o script.
**Reservado para a Fase 2 do épico #30 (#28):** a tabela de portões do modo despachado — o que cada
skill decide sozinha numa sessão `claude -p` e onde para — entra aqui como terceira seção; até lá,
vale o item 5 do primeiro bloco e o item 4 do segundo.

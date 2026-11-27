# Blocos opcionais das skills `gm-*`

Irmão de `convencoes.md`: blocos que valem só para **algumas** skills. Cada seção `##` daqui é
carimbada por `node scripts/skills-comum.mjs`, byte a byte, em toda `skills/gm-*/SKILL.md` que já
tenha aquele cabeçalho — a skill entra no bloco escrevendo o cabeçalho, e sai apagando-o. Ao
contrário de `convencoes.md`, **não** há "todos ou nenhum": skill sem o cabeçalho fica como está.
Cabeçalho que exista nas duas fontes é erro (código `2`): um bloco tem uma fonte só.

As seções abaixo são instruções de skill: ficam em inglês, e o que o humano lê fica em pt-BR.

## Ambiente na entrada

Before the first test, build or commit — a broken environment found halfway costs the minutes
already spent. Read the item *Ambiente* of the workspace `CLAUDE.md`, wherever it sits (by
convention under `## Convenções da esteira`), and check, in this order; stop at the first failure
with the reason and the output that proves it (no human → `PARADA: ambiente — <o que falta>`):

1. **Disk.** Free space where the working tree lives (`df -Pk .`, column *Available*) is at least
   the minimum the item declares — 2 GB when it declares none.
2. **Dependencies.** Every package the diff touches that has a lockfile next to its `package.json`
   has its `node_modules/` (a folder or a junction). Missing → do what the item declares for
   providing them; nothing declared → stop. Never install by default: installing is what fills the
   disk.
3. **Services.** Each service the item declares, by the command it gives to prove it is up. None
   declared → nothing to check.

No *Ambiente* item at all → checks 1 and 2 with the defaults, and one line saying the workspace
declares none. Applies to `gm-correcao` only on the *Corrige* path, the one that needs a checkout.

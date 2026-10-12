Meta: trechos normativos da Área 4 da spec. O que vem abaixo de cada `---` é o conteúdo a copiar,
verbatim; o que vem acima é meta.

### A — `## Ambiente na entrada` (seção nova; em `gm-ship` e `gm-correcao`, idêntica nas duas)

Posição: logo antes de `## Preconditions`, nas duas skills.

---

## Ambiente na entrada

Before the first test, build or commit — a broken environment found halfway costs the minutes
already spent. Read the item *Ambiente* of `## Convenções da esteira` in the workspace `CLAUDE.md`
and check, in this order; stop at the first failure with the reason and the output that proves it
(no human → `PARADA: ambiente — <o que falta>`):

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

### B — precondição 4 do `gm-ship` (substitui o item 4 inteiro; numeração dos itens não muda)

---

4. **Run the test gate the workspace declares** — the item *Portão de teste* of
   `## Convenções da esteira` in the workspace `CLAUDE.md`. It says what runs **locally before the
   PR** and **where the full suite runs**: `local` or `CI`. The local part always includes the
   typecheck the CI runs (item *Typecheck do CI*) — a looser local check has already broken `dev`;
   no such item → stop and ask.
   - `local` → the full relevant suite runs here.
   - `CI` → only the local part runs here; the PR body names the CI checks that are the gate, and
     "entregue" is still green CI (`## Report`). With no human, the CI is not waited on.
   - No *Portão de teste* item → the rule before it existed: the full relevant suite (tests +
     typecheck of the touched packages) runs here; say in one line that the workspace declares no
     gate.

   Red → stop and show; a PR never opens on red. **Verde não encerra a checagem** — leia o
   resultado contra as decisões da spec; se a suíte ou uma medição derruba alguma, vale a regra do
   `## Open the PR` abaixo.

### C — item 2 do caminho *Corrige* do `gm-correcao` (substitui o item 2 inteiro)

---

2. **Rodar o portão de teste do workspace** — o item *Portão de teste* do `CLAUDE.md`, como na
   precondição 4 do `gm-ship`: a parte local sempre; a suíte inteira aqui quando o portão é `local`
   ou quando o item não existe. Vermelho → parar e mostrar.

### D — itens novos em `## Convenções da esteira` de `templates/CLAUDE.example.md`

Posição: logo depois do item *Typecheck do CI*.

---

- **Portão de teste**: o que roda local antes de abrir a PR (`<comandos>`, sempre com o typecheck
  do CI) e onde roda a suíte inteira: `local` ou `CI`. Com `CI`, o `/gm-ship` abre a PR com a parte
  local verde e "entregue" é o CI verde. Sem esta linha, ele roda a suíte inteira local.
- **Ambiente**: espaço livre mínimo (padrão 2 GB), como prover dependências numa worktree nova
  (ex.: junction para uma que já tem) e cada serviço de teste com o comando que prova que está de
  pé. O `/gm-ship` e o `/gm-correcao` checam na entrada e param cedo com o motivo.

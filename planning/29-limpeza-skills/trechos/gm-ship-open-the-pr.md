# gm-ship — `## Open the PR`, detector sem a mecânica

Substitui, verbatim, as linhas 55-69 de `skills/gm-ship/SKILL.md` na `origin/dev` de 2026-10-12
(56-70 depois do carimbo) — da linha "**Antes de escrever o corpo**" até a linha "**Não confunda com
a precondição 2**", inclusive; localize pelo texto. O passo 1 (`git push`) acima e o passo 2 (corpo)
abaixo ficam como estão. O conteúdo é o que vem abaixo do `---`.

---

**Antes de escrever o corpo: alguma decisão da spec caiu?** A pergunta vale da precondição 4 até o
`gh pr create`, e o gatilho é mecânico: ao escrever `## Critérios de aceite` no passo 2, confira cada
critério contra o que a suíte e as **medições desta sessão** mostraram — critério que só passa
reinterpretando a spec é decisão caída. Suíte verde não encerra a checagem: o caso que originou esta
regra foi uma medição, não um teste vermelho.

Se caiu: **não abra a PR.** PR contra spec sabidamente errada nasce mentindo para o revisor humano e
para a revisão de CI do G4, que revisa lendo o `gm:spec`. Pare e mande o humano para
`/gm-implement $ARGUMENTS`, nomeando **emenda pós-tasks**: a mecânica inteira — nota datada, task
N+1, os dois freios — está na seção `## Emenda pós-tasks` daquela skill, e só lá. A branch já
empurrada no passo 1 não atrapalha (branch sem PR não aparece no board nem dispara revisão); você
volta para cá pela precondição 3 quando a task estiver `✅`.

**Não confunda com a precondição 2:** aquela é task **pendente**; esta é tudo `✅` e a spec errada.

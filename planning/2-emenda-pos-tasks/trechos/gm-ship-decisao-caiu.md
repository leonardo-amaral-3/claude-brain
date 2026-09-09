**Antes de escrever o corpo: alguma decisão da spec caiu?** A pergunta vale da precondição 4 até o
`gh pr create`, e o gatilho é mecânico: ao escrever `## Critérios de aceite` no passo 2, confira cada
critério contra o que a suíte e as **medições desta sessão** mostraram — critério que só passa
reinterpretando a spec é decisão caída. Foi assim que o caso que originou esta regra apareceu: uma
medição, não um teste vermelho, então suíte verde não encerra a checagem.

Se caiu: **não abra a PR.** PR contra spec sabidamente errada nasce mentindo para o revisor humano e
para a revisão de CI do G4, que revisa lendo o `gm:spec`. Pare e mande o humano para
`/gm-implement $ARGUMENTS`, nomeando **emenda pós-tasks** — é lá que a emenda datada é aprovada e
escrita em `spec.md` + `gm:spec`, e é lá que nasce a task N+1, sem `/gm-spec` (que é autoria) e sem
`/gm-plan-tasks` (que re-proporia as tasks já feitas). A branch já empurrada no passo 1 não
atrapalha: branch sem PR não aparece no board nem dispara revisão, e você volta para cá pela
precondição 3 quando a task estiver `✅`.

**Não confunda com a precondição 2:** aquela é task **pendente**; esta é tudo `✅` e a spec errada.

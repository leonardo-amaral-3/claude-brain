# Esteira despachada: aviso do heredoc, fecho PROXIMO/PARADA, correções do mantenedor e 2º revisor no gm-spec — Spec

## References
- Card: [#27](https://github.com/leonardo-amaral-3/claude-brain/issues/27) — repo `leonardo-amaral-3/claude-brain` (Fase 1 do épico [#30](https://github.com/leonardo-amaral-3/claude-brain/issues/30))
- Decisão do cofre: reavaliação dos prompts da esteira, 2026-10-12 (escopo `claude-brain`)

## Execution
- Repo: `leonardo-amaral-3/claude-brain` (working dir `claude-brain/` no workspace)
- Base branch: `dev`
- Feature branch: `feat/27-esteira-despachada`
- Profundidade: **Rota curta** (só texto de skill/doc/template; sem formato em disco, sem superfície de tool, sem `brain-mcp/`)

## Requisitos & critérios de aceite
1. **Fecho.** Dado qualquer uma das 11 skills `gm-*` que têm ponto final e `## Como perguntar e como aprovar`, quando se lê o arquivo, então há a seção `## Convenções de saída` dizendo que a última linha da resposta final é `PROXIMO: /gm-<skill> <argumento>` (esteira continua) ou `PARADA: <motivo em uma frase>` (não continua). `gm-correcao` diz, além disso, que despachado **não espera CI** (nem `ScheduleWakeup`).
2. **Heredoc.** Dado a mesma seção, então ela diz "arquivo novo: Write; arquivo existente: Edit; heredoc só curto", cita o limite de 1.500 caracteres como o do hook de custo de contexto e manda corpo longo (comentário, PR, commit) por arquivo + `--body-file`/`-F`. Nenhum nome de workspace.
3. **Correções do mantenedor.**
   - `gm-ship`: o typecheck da precondição 4 é o **mesmo comando do CI**, lido do `CLAUDE.md` do workspace (a skill não nomeia tsconfig); "entregue" só com CI verde e revisão tratada, PR aberta não é entregue.
   - `gm-correcao`: não autoriza pedir re-revisão com `@claude`; a regra é uma revisão por PR e um `/gm-correcao`.
   - `gm-ship` (Report) e `gm-correcao` (Report): validado em dev fecha o card na hora (`gh issue close --reason completed`) e ele **fica em 🧪 Validação em Dev**: não espera 🚂 Release, ✅ Produção nem o `/gm-release`. Depois de fechar, conferir que o status continuou em 🧪. (Correção do braço direito em 2026-10-12 sobre o texto anterior, que dizia "🚂 Release → close".)
   - `gm-spec` (crítica) e `gm-plan-tasks` (checagens): no e2e, sistema externo lento é simulado na borda; premissa herdada de catálogo se confere contra o ambiente.
4. **2º revisor.** Dado spec sensível (dado, faturamento, migration) e workspace que declara não haver segundo humano (ou escolha de seguir sem ele), então `gm-spec` Phase 4 manda disparar um agente de IA independente (contexto novo, achados com `file:line`) e levar os achados ao humano junto da spec, antes do G2.
5. **Coerência.** `docs/esteira-gm.md` e `templates/CLAUDE.example.md` descrevem os mesmos comportamentos (leitura cruzada sem contradição).

## Technical Overview
Edição de texto em 11 `SKILL.md`, 1 doc e 1 template. O bloco `## Convenções de saída` é idêntico nas 11 (anexado ao fim de cada arquivo), no estilo do `## Como perguntar e como aprovar`. Regra de workspace nunca entra na skill: ela manda ler o comando no `CLAUDE.md` do workspace. Scripts de despacho (`d.sh`, `base*.txt`, `cadeia*.sh`) e `CLAUDE.md` da Notoria existem fora do repo, são do braço direito e **não** são editados aqui.

## Implementation Details
### Convenções de saída (11 skills)
Seção final, texto idêntico em: gm-card, gm-correcao, gm-explore, gm-hotfix, gm-implement, gm-plan-tasks, gm-prd, gm-release, gm-ship, gm-spec, gm-triage. `gm-tech-spec` (12 linhas, só aponta para outra skill) fica de fora: N/A.
### gm-correcao
Linha 148: trocar a autorização de `@claude` por "uma revisão por PR, um `/gm-correcao`; não peça re-revisão". Acrescentar na seção de fecho: despachado, não espera CI. Report: validado em dev fecha o card.
### gm-ship
Precondição 4: typecheck = comando do CI declarado no `CLAUDE.md` do workspace. Report: "entregue" exige CI verde e revisão tratada; validado em dev fecha o card na hora.
### gm-spec
Phase 3: bullet do e2e/catálogo. Phase 4: parágrafo do revisor de IA independente. Para a skill ter um alvo claro: o agente recebe só o caminho da spec, não a conversa.
### gm-plan-tasks
Quality checks: item do e2e/catálogo.
### docs e template
`docs/esteira-gm.md`: parágrafo sobre o fecho e o revisor de IA no G2. `templates/CLAUDE.example.md`: pedir que o workspace declare o comando de typecheck do CI e se há segundo humano.

## File Change Summary
- `skills/gm-{card,correcao,explore,hotfix,implement,plan-tasks,prd,release,ship,spec,triage}/SKILL.md` — seção `## Convenções de saída`
- `skills/gm-correcao/SKILL.md`, `skills/gm-ship/SKILL.md`, `skills/gm-spec/SKILL.md`, `skills/gm-plan-tasks/SKILL.md` — correções do item 3 e 4
- `docs/esteira-gm.md`, `templates/CLAUDE.example.md` — coerência
- `planning/27-esteira-despachada/` — spec e tasks

## Migrations & compatibilidade
N/A — texto; nenhum formato em disco.

## Rollback
`git revert` da PR. As skills vivas só mudam no `sync push` do release (do Leonardo).

## Verificação pós-deploy
N/A — não toca dados nem faturamento; a verificação é a de cada task (grep, leitura cruzada).

## Plano de testes
- CA1/CA2: `grep -L "## Convenções de saída" skills/gm-*/SKILL.md` lista só `gm-tech-spec`; `grep -c "PROXIMO:"` e `grep -c "1.500"` ≥1 nas 11; diff entre os blocos das 11 vazio.
- CA3: `grep -n "@claude" skills/gm-correcao/SKILL.md` não autoriza pedir; `grep -n "mesmo comando do CI" skills/gm-ship/SKILL.md`; `grep -in "tsconfig" skills/` vazio.
- CA4: `grep -n "independente" skills/gm-spec/SKILL.md` na Phase 4.
- CA5: leitura cruzada docs/template vs skills.

## Technical Decisions
- Seção idêntica em vez de editar cada ponto final: um bloco verificável por diff; a duplicação é conhecida e a Fase 3 (#29) a consolida.
- Revisor de IA vale também quando o humano escolhe "seguir sem segundo revisor": o contrapeso não pode depender de o workspace declarar.
- Descartado: pôr o nome do tsconfig na skill (repo público; regra do workspace).

## Coding Standards
Instruções das skills em inglês; texto que o humano lê em pt-BR; nada além do especificado.

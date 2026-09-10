---
name: gm-correcao
description: Turn the CI review's parecer on a PR into decisions on the record - every finding verified against the spec, then fixed, refuted, or promoted to a card, with a reply on each inline comment. Use after the review workflow posts its findings on a PR that is already in code review, before handing the PR to a human validator.
disable-model-invocation: true
argument-hint: [pr-number | owner/repo#pr | feature-folder]
---

# Correção — tratar o parecer da revisão

`gm-ship` abre a PR e o workflow de revisão publica o parecer. Esta skill fecha o que fica entre os
dois: **nenhum achado morre por silêncio**. Cada um sai daqui corrigido, refutado com evidência, ou
promovido a card — e dito na PR.

Um achado é **hipótese, não veredito**. A revisão declara a própria confiança e erra: corrigir um
falso positivo é pior que ignorá-lo, porque entra no diff com ar de correção. Verifique antes.

## Como perguntar e como aprovar

This section is identical in all eleven `gm-*` skills that have an interaction point — it is
copied, never rewritten, and any improvement to it lands in the eleven at once. The long version,
for a human reading from outside the pipeline, is in `docs/esteira-gm.md`, section
`## Como as skills perguntam`.

1. **Context before jargon.** Open with what is at stake and what changes down each path, in
   pt-BR. Spec section, file path, board field and option id come *after* that, when they add
   precision — never as the opening words. Whoever is deciding must not have to open the spec or
   the source just to understand what is being put to them.
2. **Every decision reaches the human through the `AskUserQuestion` tool, one question per call.**
   No batching, no `multiSelect`. Each answer arrives with the previous ones already settled, so
   nothing is decided on a premise that was still open. Five decisions is five calls, in order.
3. **Two standard sets, chosen by what is at stake.**
   - *Artefato* (spec, card body, PR body) → **Aprovar · Ajustar · Rejeitar**. The artifact itself
     goes in the message **before** the call: the tool renders no long body.
   - *Ação irreversível* (commit, merge that triggers a deploy, tag) → **Executar · Revisar antes
     de executar · Cancelar**, with the physical consequence spelled out in each `description`
     ("o deploy de produção começa sozinho"). "Ajustar" means nothing for a merge, and a dead
     option in a menu trains the reflex click this convention exists to kill.
4. **A list longer than four never becomes a silently truncated menu.** The tool takes 2–4
   options. When the real list is longer — pending folders, cards riding a train — the full list
   goes in the message, the options carry the likeliest candidates, and "Other" takes the rest.
   Never drop a candidate without saying that it was dropped.
5. **Silence is never a yes.** "Other" is always available, so free text is never taken away. Do
   not argue one option into being the obvious one. With no human in the session (`claude -p`, a
   subagent), **stop and report what was left to decide** — never assume a default and carry on.

Tool limits, so a question is never rejected or silently cut: 2–4 options per question, `header`
up to 12 characters, `label` 1–5 words, "Other" appended automatically (never write it yourself).
Instructions in this file stay in English; **everything the human reads — the question, the labels
and every `description` — is written in pt-BR.**

## Preconditions

1. **Resolver PR e repo** — o workspace tem cinco repos (`modulo-processos`, `shd-rpa`,
   `processos-criticas`, `processos-core`, `criticas-report`), então repo nunca é implícito:
   - `owner/repo#123` → explícito, use;
   - pasta de feature → leia `planning/<pasta>/spec.md` → `## Execution` (repo, branch) e ache a PR
     da branch: `gh pr list --repo <owner>/<repo> --head <branch>`;
   - só o número → resolva pelo repo do diretório corrente (`gh repo view --json nameWithOwner`) e
     **confirme antes de agir**, porque o mesmo número existe nos cinco repos e tratar parecer na PR
     errada escreve resposta pública no lugar errado. Título, branch e autor vão na mensagem, e a
     confirmação vem por uma chamada `AskUserQuestion` — header `PR alvo`, pergunta e opções em pt-BR:

     > Você passou só o número, e o mesmo número existe nos cinco repos do workspace — tratar o
     > parecer na PR errada publica resposta pública no lugar errado, e ela fica lá. Pelo diretório
     > atual, o <n> é esta: «<título>», branch `<branch>`, em `<owner>/<repo>`, aberta por <autor>.
     >
     > - **É esta** — sigo com ela: leio o parecer, verifico cada achado, corrijo ou refuto, e cada
     >   inline recebe resposta pública nesta PR.
     > - **Escolher outra** — não toco nesta; mostro as PRs abertas com parecer publicado e você aponta.

   - nada → **a lista inteira vai na mensagem** — uma linha por PR aberta com comentário
     `<!-- gm:revisao-status -->`: número, título, repo e quantos achados o parecer trouxe — e a
     escolha vem por uma chamada `AskUserQuestion`, header `Qual PR`, opções em pt-BR nomeando cada
     candidata pelo que ela é, nunca só pelo número:

     > Estas PRs têm parecer publicado esperando tratamento; esta sessão trata **uma**.
     >
     > - **#<n> <duas ou três palavras do título>** — «<título completo>», `<repo>`, <k> achados
     >   inline, parecer de <data>.
     > - … (as demais na mesma forma)

     Mais de quatro PRs → as opções levam as de parecer mais recente, a lista **inteira** continua na
     mensagem, e a mensagem diz em voz alta que as demais chegam por "Other". PR omitida em silêncio
     é parecer que ninguém trata.
   Todo comando `gh` daqui em diante leva `--repo <owner>/<repo>` explícito.
2. **Existe parecer?** Ler o comentário `<!-- gm:revisao-status -->`. Só o estado **"Revisada"**
   produz parecer. Qualquer outro (`Não revisei — …`) significa que **não há o que corrigir** —
   pare e diga qual estado foi:
   - *"não é idêntico ao da `main`"* → a trava da action compara com a **branch default**, não com a
     base. Diagnostique: `git diff origin/main origin/<head> -- .github/workflows/revisao-claude.yml`.
     Enquanto `main` e `dev` divergirem, **nenhuma** PR é revisada. Aponte e pare.
   - *"revisão foi interrompida"* → estado C. O teto é `vars.REVISAO_TIMEOUT_MINUTOS`, ajustável sem
     PR. Aponte e pare.
3. Dentro do repo do módulo, na branch da PR, `git status` limpo. Responder inline exige escopo de
   escrita no `gh`; 403 → `! gh auth refresh -s repo`.

## Coletar

- Parecer em prosa: o comentário **do autor `claude`** — o mais recente, se houver re-revisão.
  Identifique pelo autor, **não** pelo texto: ele não tem marcador HTML (só o `gm:revisao-status`,
  que é do autor `github-actions`, tem). Traz conformidade · divergências · bugs e riscos · sugestões.
- Inline: `gh api "repos/<owner>/<repo>/pulls/<n>/comments"` — cada um tem `id`, `path`, `line`.
  Filtre pelos do autor `claude`: humanos também comentam inline, e o parecer deles não é seu.
- **A linhagem do card**, o mesmo insumo que a revisão usou: `gm:spec` (épico: `gm:spec-ref` no card
  em voo + `gm:spec` no pai), `gm:tasks`, e os `gm:decisao`. Achado só é "procede" **à luz da spec** —
  sem ela você julga código no vácuo, que é exatamente o que o G4 existe para evitar.

## Triar

Verifique cada achado até `file:line` **antes** de classificar. Depois, quatro baldes — os três
últimos são os protocolos do `gm-implement`, não invente outros; a **emenda pós-tasks**, quarta
seção de lá, é anterior à PR e não se aplica aqui:

| Balde | Quando | O que fazer |
|---|---|---|
| **Corrige** | Procede e cabe no escopo da spec | corrigir aqui, um commit por achado |
| **Refuta** | Não procede — a revisão errou | **não** corrigir; responder o inline com a evidência que refuta |
| **Achado** | Procede, mas é outro assunto (bug pré-existente, dívida vizinha) | protocolo de achado: card novo, **não** corrigir aqui |
| **Desvio** | Contradiz uma decisão da spec | protocolo de desvio do `gm-implement`: parar, propor a emenda e levá-la ao humano como escolha antes de escrever |

Escopo extra é o que a revisão foi construída para pegar — **não o reintroduza corrigindo**. "Já que
estou aqui" no tratamento do parecer é o mesmo defeito, uma estação depois.

Uma sugestão (não-bug) só vira commit se fechar critério de aceite; senão responda por que não.

## Corrigir

1. Um commit por achado, mensagem dizendo qual achado fecha e por quê — não "corrige review".
2. **Rodar a suíte completa** dos pacotes tocados (api/web + typecheck), como o `gm-ship` exige.
   Vermelho → parar e mostrar.
3. Push na mesma branch. **Não** alternar draft→ready: isso redispara a revisão inteira e queima
   cota. Re-revisão é sob demanda, mencionando `@claude`, e só se o diff mudou o bastante para valer.

## Responder na PR

**Todo inline recebe resposta** — é o que fecha o laço para quem revisar depois:

```
gh api -X POST "repos/<owner>/<repo>/pulls/<n>/comments/<comment-id>/replies" -f body="..."
```

- corrigido → o commit (`<sha>`) e o que mudou, em uma linha;
- refutado → a evidência (`arquivo:linha`) que mostra por que não procede;
- virou card → `#<n>`, e por que não cabia aqui.

E um comentário-resumo, sticky por `<!-- gm:correcao -->` (create-or-update pelo marcador, como o
`gm:revisao-status`), em pt-BR:

```markdown
<!-- gm:correcao -->
## 🔧 Parecer da revisão tratado

| # | Achado | Decisão | Onde |
|---|---|---|---|
| 1 | <resumo> | corrigido | `<sha>` |
| 2 | <resumo> | não procede | `arquivo:linha` refuta |
| 3 | <resumo> | card #<n> | fora do escopo desta PR |

<uma linha por achado refutado explicando o porquê — é a parte que o revisor humano confere>
```

## Board e registro

- O card **não muda de estação**: segue em 👀 Revisão (project-id `<project-id>`, Status
  `<field:Status>`). Tratar parecer é parte da revisão, não uma volta para Implementação.
- Achado que virou card entra em 📥 Triagem (`<opt:Status=Triagem>`).
- **Emenda à spec** (balde Desvio) vai para `spec.md` **e** para o comentário `gm:spec` do card, com
  nota datada — a spec nunca pode virar ficção histórica.
- Grave com `mcp__brain__lembrar` **na hora** todo achado refutado e todo desvio: por que não
  procedia, ou o que a spec passou a dizer. Achado refutado sem registro volta na próxima revisão.

## Report

Tabela dos achados com a decisão de cada um, os commits, o resultado da suíte, e os cards abertos.

Depois diga o que falta: PR pronta para a validação humana → merge em `dev` → o card vai para
🧪 Validação em Dev, onde uma **pessoa nomeada** roda o checklist da PR (SLA 7 dias). Se algum achado
virou desvio e a spec mudou, diga que o checklist de validação mudou junto.

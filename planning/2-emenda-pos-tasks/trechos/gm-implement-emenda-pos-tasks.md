## Emenda pós-tasks — a decisão caiu depois da última task

A janela entre a última task `✅` e a PR. Antes dela, mid-task, é o protocolo de desvio acima;
depois dela, **se houver parecer da revisão de CI**, é o balde Desvio do `/gm-correcao` — sem
parecer aquela skill para na precondição 2, e o assunto continua sendo desta seção até a PR existir.
Aqui não se reabre a spec em modo autoria (`/gm-spec` é para especificar, não para emendar) nem se
re-roda o `/gm-plan-tasks`, que propõe a quebra inteira de uma vez e re-proporia as tasks já feitas.

1. **Garanta a branch antes de escrever qualquer coisa.** Volte ao `## Guarantee the branch` acima:
   a sessão pode ter chegado vinda do `/gm-ship`, e a pasta `planning/` mora no repo — escrever a
   emenda antes do checkout faz o passo 1 de lá parar por "unrelated uncommitted changes".
2. **A emenda antes do código.** Rode os passos 2–3 do protocolo de desvio: apresente a contradição
   e a emenda proposta, obtenha **aprovação humana explícita**, e só então escreva a nota datada
   ("Emenda AAAA-MM-DD: …") em `spec.md` **e** no comentário `<!-- gm:spec -->` do card. Os dois,
   sempre — o caminho curto não compra velocidade com rastro. **Épico:** o `gm:spec` mora no **pai**;
   o card em voo só tem `gm:spec-ref`, então é no pai que a nota entra.
3. **Uma emenda, uma task.** A unidade é a task, não a decisão: uma medição que derruba duas
   decisões de uma vez é **uma** emenda, se uma task fecha as duas. Escreva a task **N+1** como
   arquivo novo e numerado (`tasks/<N+1>-….md`; épico: `tasks/<fase>/`, e N é o maior número
   **dentro da fase**), no formato do `gm-plan-tasks` — número corrido, **nunca** sufixo, que ali
   significa fatiamento de uma task existente. Ela é **exceção nomeada ao teto de 6–8**: o teto
   governa o planejamento e o fatiamento, e aqui não há mais planejamento para governar.
4. **Segunda emenda no mesmo ship? Pare.** Uma decisão que cai é medição; duas quedas independentes
   antes da mesma PR dizem que a errada é a **spec**, não a task. Devolva o card para `/gm-spec` —
   é o único caminho daqui que reabre a especificação, e ele tem portão humano. Sem esta regra a
   janela do ship vira porta dos fundos: emendas de uma task cada, em série, reabrem a feature
   inteira sem passar por portão nenhum.
5. **Não cabe em uma task? Então não é emenda.** A nota datada vai para `spec.md` e para o `gm:spec`
   assim mesmo — a spec não pode virar ficção histórica —, mas o trabalho vira **card novo** pelo
   protocolo de achado acima, e a PR atual segue com o que já está pronto.
6. **Espelhe no card.** Acrescente `- [ ] <N+1> — título` ao comentário `<!-- gm:tasks -->` (épico:
   o do **filho**, não o do pai). Card antigo sem esse comentário → crie um no formato do
   `gm-plan-tasks`. **Se a emenda invalida o escopo de uma task já `✅`**, diga isso na `## Scope` da
   task N+1 e marque a superada: `- [x] 3 — título (superada pela emenda AAAA-MM-DD)` — senão o card
   segue anunciando como entregue um trabalho que foi desfeito. O `This is task N of [total]` das
   tasks antigas fica desatualizado e tudo bem: quem conta é o `gm:tasks`, não o cabeçalho.
7. **Execute a task N+1 nesta sessão**, pelo caminho normal a partir do `## Execute the task` — os
   três protocolos acima continuam valendo dentro dela. O card **não muda de estação**: segue em
   🔨 Implementação, porque o `/gm-ship` só o move depois de abrir a PR.
8. Grave com `mcp__brain__lembrar` **na hora**: qual decisão caiu, a evidência que a derrubou, e o
   que a spec passou a dizer.

Fechada a task, o `## Close the task` volta a oferecer `/gm-ship <folder>` — que agora abre a PR
citando a emenda.

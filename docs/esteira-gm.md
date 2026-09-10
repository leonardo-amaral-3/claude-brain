# A esteira `gm-*`

Doze skills que levam demanda de "chegou uma mensagem" até "está em produção". A ideia é simples:
**uma estação por vez, com um portão explícito entre elas**, e o board do GitHub Projects como a
única fonte da verdade sobre onde cada coisa está.

Nenhuma skill `gm-*` tem ID de board escrito dentro dela. Todas leem a seção `## Board` do
`CLAUDE.md` do workspace — trocar de board é editar um arquivo, não doze. Se a seção não existir,
a skill **para e pede**: escrever card no board errado é pior que não escrever.

Todas são `disable-model-invocation: true` — só rodam quando você digita `/gm-...`. O modelo não
decide sozinho abrir card nem cortar release.

## O caminho

```
relato bruto
     │
     ▼
/gm-triage ──── não é demanda? responde ou roteia, e para aqui
     │  📥 Triagem
     ▼
/gm-card ────── portão G1: critérios de aceite obrigatórios
     │  📋 Backlog          + sugere a rota (completa | curta | hotfix)
     ▼
/gm-spec ────── spec única (requisitos + técnica), crítica adversarial,
     │  🎯 Especificação    liberada por escolha do humano, publicada no card
     ▼
/gm-plan-tasks  6–8 tasks independentes; cada arquivo de task é o prompt
     │  🎯                  completo de um agente novo
     ▼
/gm-implement   uma task por vez, de preferência em sessão nova:
     │  🔨 Implementação    branch certo, testes ANTES de apresentar,
     │                      commit só depois de Executar escolhido
     ▼
/gm-ship ────── suíte completa, PR com o contrato de aceite + checklist
     │  👀 Revisão          de validação em dev
     ▼
/gm-correcao ── cada achado do review: corrigido, refutado ou promovido
     │  👀                  a card — com resposta em cada comentário inline
     ▼
        🧪 Validação em Dev (humano)
     ▼
/gm-release ─── o trem: fila validada → PR dev→main → tag calver →
        🚂 → ✅            notas de release → verificação pós-deploy
```

## As rotas

Nem toda demanda merece a esteira inteira. O `/gm-card` **sugere** a rota; o humano decide.

| Rota | Quando | Caminho |
|---|---|---|
| **Completa** | o padrão: muda contrato, schema ou regra de negócio | triage → card → spec → tasks → implement → ship → release |
| **Curta** | exige **todos**: não altera contrato de API/schema/regra de negócio, diff pequeno, trivialmente reversível | card → spec curta → implement → ship |
| **Hotfix** | S1 real em produção | `/gm-hotfix`: branch a partir de `main` (nunca de `dev`), card mínimo com repro + risco + query de verificação |

## As skills

### Entrada

**`/gm-triage [relato bruto]`** — a porta. Classifica tipo/severidade/classe/módulo com critério
escrito, **deduplica contra issues abertas e fechadas antes de criar qualquer coisa**, preenche o
template do tipo, registra origem e solicitante, e estaciona em 📥 Triagem.

Também roteia para fora o que não é demanda. "Isso não é demanda" é um desfecho legítimo e
frequente — criar card para tudo é como um board se enche de ruído.

**`/gm-explore [pergunta]`** — investigação read-only: "como isso funciona hoje?", "um usuário
consegue fazer X?". Responde com evidência `arquivo:linha`, confere se já existe card sobre o
assunto, e **não propõe nem implementa solução**. Use antes de decidir se algo deve mudar.

### Especificação

**`/gm-card [direção | #issue]`** — portão **G1**. Captura estado atual com evidência, direção
desejada, motivação e **critérios de aceite obrigatórios**. Ou cria do zero, ou promove uma issue
que a triagem deixou em 📥 — editando o corpo da issue no lugar, nunca abrindo uma segunda.

**`/gm-spec [#issue]`** — a especificação única: requisitos e técnica no mesmo documento, semeada
pelo card, construída com exploração do código e perguntas focadas, endurecida por uma crítica
adversarial e liberada por uma escolha sua no portão. Publicada como comentário no card, para que
os passos seguintes a encontrem no GitHub.

É **spec viva**: emenda aprovada durante a implementação (protocolo de desvio do `/gm-implement`)
atualiza o `spec.md` *e* o comentário, com nota datada. A spec publicada nunca vira mentira
histórica. Isso inclui a **emenda pós-tasks**, quando a decisão cai entre a última task e a PR.

**`/gm-plan-tasks [pasta-da-feature]`** — quebra a spec em tasks ordenadas e independentes. Cada
arquivo de task é o **prompt completo** de um agente novo, que não viu a conversa. Apresenta a
quebra inteira como **um** artefato — você responde *Aprovar*, *Ajustar* ou *Rejeitar*, e não uma
pergunta por task —, respeita o teto de 6–8 tasks e espelha a lista no card.

### Implementação

**`/gm-implement [pasta-da-feature]`** — executa **uma** task pendente, de preferência em sessão
nova. Branch certo no repo certo, criado ligado ao card pelo campo Development e aberto numa
worktree só dele (`## Uma worktree por card`, abaixo). O arquivo da task
é o prompt. Testes rodam **antes** de apresentar. Resumo ordenado por risco. Commit só depois de
você escolher *Executar*. Se a realidade contradiz a spec, entra o protocolo de desvio em vez de
improviso silencioso. E se a decisão cair depois da última task, com a PR ainda por abrir, é aqui
que a **emenda pós-tasks** nasce: nota datada aprovada pelo humano, uma task nova, e o `/gm-ship`
retomado.

**`/gm-ship [pasta-da-feature]`** — fecha o loop: confere que toda task está completa, roda a suíte
inteira, faz push, abre o PR carregando o contrato de critérios de aceite e o checklist de
validação em dev, referencia o card e move para 👀 Revisão.

**`/gm-correcao [pr]`** — pega o parecer do review de CI e transforma cada achado em decisão
registrada: verificado contra a spec, e então corrigido, refutado ou promovido a card — com
resposta em cada comentário inline. Roda depois do review e antes de entregar o PR ao validador
humano.

### Saída

**`/gm-release`** — corta o trem: lê a fila validada em 🚂 Release, reconcilia contra o que está
mesmo mergeado em `dev`, classifica o trem como trivial ou sensível (migrations, tratamento de
dados), abre o PR dev→main, tagueia com calver, publica notas de release duplas (técnica e para o
cliente) e roda a verificação pós-deploy **bloqueante** quando o trem é sensível.

**`/gm-hotfix [#issue | descrição]`** — o trilho expedite para S1 de verdade. Prova o critério de
S1 e o limite de um por vez, abre card mínimo com repro + risco + query de verificação, cria
`release/hotfix-*` a partir de `main` (nunca de `dev`), implementa com testes e abre o PR.

### Fora da esteira

**`/mapear <repo>`** — gera ou atualiza o mapa de arquitetura do repo em
`<workspace>/claude/mapas/<repo>.md`, que o brain indexa com `source: mapa`. É o que permite ao
Claude se orientar num repo sem rodar exploração pesada toda sessão. Rode depois de mudança
estrutural grande.

**`/diario [título]`** — escreve ou enriquece a nota da sessão no cofre Obsidian do workspace: o
que foi feito e decidido, links para PRs/cards/specs, pendências e como retomar. O hook
`SessionEnd` já faz isso automaticamente; a skill serve para quando você quer no meio da sessão ou
para consertar uma nota que ficou pela metade.

**`/defuddle <url>`** — lê uma página web já limpa de navegação e anúncio, gastando bem menos
token que o `WebFetch`. Precisa de `npm install -g defuddle`.

## Como as skills perguntam

Toda skill `gm-*` com ponto de interação carrega, logo depois da prosa de missão, um bloco
`## Como perguntar e como aprovar` — idêntico ao caractere nas onze que têm um. Esta é a versão
longa dele, para ler de fora da esteira; se as duas divergirem, a das skills é a que roda.

**O problema que isto resolve.** Um portão que se atravessa digitando "aprovo" não é portão, é
carimbo. Esta esteira já abre mão de dois controles que a norma completa tem — o segundo humano no
G2 e o revisor humano no G4 —, então o que sobra é você lendo antes de decidir. Pedir a decisão
como texto livre convida o reflexo; oferecer caminhos nomeados, cada um com a consequência escrita
ao lado, obriga a comparar antes de clicar.

1. **Contexto antes do jargão.** A pergunta abre com o que está em jogo e o que muda em cada
   caminho, em português. Seção da spec, caminho de arquivo, campo do board e id de opção vêm
   depois, quando acrescentam precisão. O teste é simples: dá para decidir sem abrir a spec nem o
   código? Se não dá, a pergunta está mal feita.

2. **Uma pergunta por vez.** Toda decisão chega pela tool `AskUserQuestion`, uma por chamada — sem
   lote e sem múltipla escolha. Custa mais rodadas (um Q&A de spec vira cinco ou dez), e é de
   propósito: pergunta feita antes da hora é pergunta respondida no chute, porque a premissa dela
   ainda estava aberta. Assim cada resposta chega com as anteriores já na mesa.

3. **Dois conjuntos padrão.** Quando o que está em jogo é um **artefato** — a spec, o corpo de um
   card, o corpo de um PR — as opções são *Aprovar · Ajustar · Rejeitar*, e o artefato vem na
   mensagem anterior, porque o menu não exibe texto longo. Quando é uma **ação irreversível** — um
   commit, um merge que dispara deploy, uma tag — são *Executar · Revisar antes de executar ·
   Cancelar*, cada uma dizendo o que acontece no mundo físico ("o deploy de produção começa
   sozinho"). Os dois existem separados porque "ajustar" não quer dizer nada num merge, e opção
   morta em menu ensina exatamente o clique automático que queremos matar.

4. **Lista longa não vira menu truncado.** O menu comporta quatro opções. Quando os candidatos
   reais são mais — pastas com task pendente, cards pegando carona no trem —, a lista inteira vai
   na mensagem, o menu leva os mais prováveis e "Other" recebe o resto. O que não pode é sumir
   candidato em silêncio.

5. **Silêncio não é sim.** "Other" está sempre disponível, então escrever à mão nunca é proibido, e
   nenhuma opção é vendida como a óbvia. Numa sessão sem humano (`claude -p`, subagente), a skill
   **para e diz o que ficou por decidir** em vez de assumir um padrão e seguir.

**O que isto não muda.** Os gates continuam os mesmos — quantos são, onde ficam e quem responde.
Mudou o gesto de responder, não quem manda.

## Uma worktree por card

Todo card em voo trabalha numa pasta só dele: `<workspace>/<repo>-<n>-<slug>` — irmã do repo,
dentro do workspace. O checkout principal deixa de ser lugar de card.

**Por que irmã, e não em qualquer canto do disco.** O `CLAUDE.md` do workspace e o
`brain-workspaces.json` resolvem **por prefixo de caminho**. Uma worktree fora do prefixo — solta
em `~/`, por exemplo — não tem nenhum `CLAUDE.md` de workspace acima dela: fica sem `## Board`,
sem as duas regras do cérebro, e fora de qualquer workspace do brain. A pasta funciona, o git
funciona, e a sessão que roda lá dentro perde as coordenadas sem receber aviso nenhum.

**Por que uma por card.** Vários cards em voo ao mesmo tempo, às vezes no mesmo repo: cada um com a
sua árvore, ninguém troca de branch por cima do trabalho do outro, e `git worktree list` responde
de uma olhada o que está aberto.

**Quem cria e quem apaga.** O `/gm-implement` cria ao garantir a branch — a mesma branch ligada ao
card pelo campo Development, agora dentro da worktree. O `/gm-ship` apaga assim que a PR abre e o
card vai para 👀 Revisão: some a pasta, não a branch, que segue no GitHub com a PR. Se depois disso
o parecer da revisão pedir código, o `/gm-correcao` recria pela mesma convenção — corrigir no
checkout principal fura a regra uma estação adiante. O `/gm-hotfix` usa a mesma convenção na
`release/hotfix-*` e apaga quando o back-merge entra: a pressa não compra exceção.

**A `planning/` mora dentro do repo**, então cada worktree carrega a sua cópia da spec e dos
arquivos de task. A que vale é a da worktree do card: é ela que está na branch e é ela que a PR vai
carregar. A cópia do checkout principal é o que a `dev` tinha no último merge — da segunda task em
diante ela ainda mostra as anteriores como pendentes e não sabe de emenda nenhuma. Na dúvida,
`git branch --show-current` dentro da pasta diz qual cópia você está lendo.

**Apagar não é forçar.** `git worktree remove` recusa quando sobrou arquivo não commitado na pasta,
e a recusa é informação: alguma coisa ficou de fora da PR. A pasta fica de pé até alguém olhar.

**Os cards que nasceram antes da regra terminam onde estão.** Mover worktree de card em voo troca o
chão debaixo de uma sessão que pode estar aberta; a regra vale dos próximos cards em diante.

## A regra que sustenta tudo

Duas regras vão no `CLAUDE.md` do workspace (o template já traz as duas):

1. **O cérebro vem antes da exploração.** Antes de abrir arquivo na mão, rodar `Grep` ou lançar
   agente de exploração, consulte o `search_context`. Grep continua válido — só não como
   *primeiro* movimento.

2. **Registre a decisão na hora.** Decidiu algo? `mcp__brain__lembrar` naquele momento, com o
   **porquê** e o que foi descartado. Não espere o fim da sessão: se ela morrer antes, o porquê se
   perde — e o porquê é a única parte que ninguém reconstrói lendo o diff depois.

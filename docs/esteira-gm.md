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
/gm-ship ────── suíte completa, G4 (revisão de IA), PR com o contrato de
     │  👀 Revisão          aceite + checklist de validação em dev e, com as
     │                      condições do `merge-dev.mjs`, o merge na dev
     ▼
/gm-correcao ── cada achado do review: corrigido, refutado ou promovido
     │  👀                  a card — com resposta em cada comentário inline
     ▼
        🧪 Validação em Dev (itens [comando] e [humano])
     ▼
/gm-release ─── o trem: fila no corte → G5 por trem → PR do corte → main →
        🚂 → ✅            tag calver → notas → verificação pós-deploy
```

**`/gm-frente <owner>/<repo>#<n>`** conduz tudo isto sozinha para um card ou épico entregue de
uma vez, em ondas e fases paralelas (`## A frente`, abaixo). Cada estação continua sendo a skill de
sempre: a frente só as abre, na ordem certa, e lê a última linha de cada uma.

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

Relato com vários pontos do mesmo escopo (mesmo objetivo numa frase, validados juntos) nasce **um**
card `épico` com `## Pontos`, não um card por ponto; só o ponto independente de verdade vira card
próprio, e na dúvida é um card só. Quem corta as fases é o `/gm-spec`.

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

Spec sensível é a que toca **dado, faturamento, deploy ou migration**, e quem decide é a regra do
`skills/gm-spec/sensivel.mjs`, não o julgamento livre da sessão: vale qualquer condição — o autor
disse sim, o Jev disse sim, o Jev disse não com confiança baixa, ou o Jev não respondeu. O Jev só
acrescenta a exigência, nunca a dispensa; sem chave, ou sem o opt-in de envio, toda spec é sensível.
O opt-in é `~/.claude/gm-spec-jev.json` com `{"enviarSpecAoJev": true}`: autoriza mandar o texto da
spec ao Jev nesta máquina, e vem desligado por padrão.

Em spec sensível, o portão G2 pede um segundo olhar, e o **revisor de IA independente** roda **em
toda spec sensível** — nas duas respostas do `2º revisor`, ou direto quando o workspace declara que
**não há segundo humano**. É um agente de contexto novo, que recebe só o caminho da spec — não a
conversa — e devolve achados com `file:line`. Os achados chegam a você junto da spec, antes da
aprovação. O contrapeso não depende de o workspace tê-lo declarado.

Toda premissa de que o desenho depende (formato de dado, mês vazio, campo de uma rota, código
existente) vira uma linha de `## Premissas medidas`, com a prova rodada na própria sessão contra o
ambiente que a spec nomeia; premissa só provada no papel é ponto aberto do G2. Um épico vindo da
triagem é fatiado pelos seus `## Pontos`, qualquer que seja o tamanho.

É **spec viva**: emenda aprovada durante a implementação (protocolo de desvio do `/gm-implement`)
atualiza o `spec.md` *e* o comentário, com nota datada. A spec publicada nunca vira mentira
histórica. Isso inclui a **emenda pós-tasks**, quando a decisão cai entre a última task e a PR.

**`/gm-plan-tasks [pasta-da-feature]`** — quebra a spec em tasks ordenadas e independentes. Cada
arquivo de task é o **prompt completo** de um agente novo, que não viu a conversa. Apresenta a
quebra inteira como **um** artefato — você responde *Aprovar*, *Ajustar* ou *Rejeitar*, e não uma
pergunta por task —, respeita o teto de 6–8 tasks e espelha a lista no card. Spec escrita a partir
de 2026-10-12 sem `## Premissas medidas`, ou com linha sem prova, é recusada e volta ao `/gm-spec`,
que escreve a seção. Contrato aprovado antes dela — spec antiga, `tech-spec.md`, fase de épico —
segue: o próprio `/gm-plan-tasks` mede as premissas de que as tasks dependem e avisa em uma linha.

### Implementação

**`/gm-implement [pasta-da-feature]`** — executa **uma** task pendente, de preferência em sessão
nova. Branch certo no repo certo, criado ligado ao card pelo campo Development e aberto numa
worktree só dele (`## Uma worktree por card`, abaixo). O arquivo da task
é o prompt. Testes rodam **antes** de apresentar. Resumo ordenado por risco. Commit só depois de
você escolher *Executar*. Se a realidade contradiz a spec, entra o protocolo de desvio em vez de
improviso silencioso. E se a decisão cair depois da última task, com a PR ainda por abrir, é aqui
que a **emenda pós-tasks** nasce: nota datada aprovada pelo humano, uma task nova, e o `/gm-ship`
retomado.

Com `--task <arquivo>` (o jeito que a frente chama), executa **só** aquela task, numa branch que a
frente já criou: recusa rodar com dependência que não está `✅` e recusa o commit quando o diff sai
do `Toca:` da task (as duas conferências são do `ondas.mjs --conferir`). O `✅` da task entra no
próprio commit, em todos os modos; no modo task a sessão não dá push nem marca o checkbox do
`gm:tasks` — quem faz é o condutor, uma escrita por vez.

**`/gm-ship [pasta-da-feature]`** — fecha o loop: confere que toda task está completa, roda a suíte
inteira, passa pelo **G4**, faz push, abre o PR carregando o contrato de critérios de aceite e o
checklist de validação em dev, referencia o card e move para 👀 Revisão. A PR nasce com base na
`dev`; outra base só com a linha `Motivo da base:` no `## Execution` da spec, copiada no corpo da PR.

O **G4** é um agente independente, só de leitura, que recebe apenas a spec, o `gm:spec-ref` da fase
e o intervalo `origin/<base>...HEAD`, e devolve achados com `arquivo:linha`. A sessão corrige
(commit e portão de novo) ou refuta, com o porquê, cada um; o resultado vai para o comentário
`<!-- gm:g4 -->` da PR, com o head revisado, o head final e o portão local. Os itens do
`## Validação em dev` da PR começam por `[comando]` (rodado pela sessão) ou `[humano]`.

**Merge na dev.** Com o G4 tratado, o `merge-dev.mjs` lê (só lê) seis condições: base certa, PR
mergeável, branch atualizada com a `dev`, CI verde — ou, quando o `CLAUDE.md` declara que não há CI,
o portão local verde no head atual —, `gm:g4` sem achado pendente e **spec não sensível**
(`sensivel.mjs --consultar`, sem rede). Tudo verde, a skill faz `gh pr merge --merge
--match-head-commit <head>`, o card vai para 🧪 Validação em Dev e a worktree é removida. Spec
sensível, ou qualquer condição vermelha, para com a condição dita. Branch desatualizada → a skill
junta a `dev`, roda o portão de novo e volta ao script (no máximo duas vezes); CI ainda rodando →
fecha com `PROXIMO: /gm-ship <pasta> --card <n> --merge`, que é a passada que o condutor abre depois
de esperar o CI. A `main` nunca é tocada aqui.

**`/gm-correcao [pr]`** — pega o parecer do review de CI e transforma cada achado em decisão
registrada: verificado contra a spec, e então corrigido, refutado ou promovido a card — com
resposta em cada comentário inline. Roda depois do review e antes de entregar o PR ao validador
humano. Todo push numa PR aberta refaz o portão local e o G4 sobre o intervalo novo, atualiza o
`gm:g4`, e a linha `PROXIMO` volta para `/gm-ship <pasta> --card <n> --merge`.

`/gm-ship` e `/gm-correcao` abrem com **`## Ambiente na entrada`**: disco livre, dependências
instaladas e os serviços que o `CLAUDE.md` declara, parando cedo com o motivo antes do primeiro
teste. O portão de teste também é lido de lá (*Portão de teste*: `local` ou `CI`); sem a linha, vale
a suíte inteira local, como antes.

### Saída

**`/gm-release`** — corta o trem: lê a fila validada (🚂 Release, mais os cards fechados em 🧪 Validação em Dev), reconcilia contra o que está
mesmo mergeado em `dev`, classifica o trem como trivial ou sensível (migrations, tratamento de
dados), tagueia com calver, publica notas de release duplas (técnica e para o cliente) e roda a
verificação pós-deploy **bloqueante** quando o trem é sensível.

O trem é **o que estava na `dev` no corte**: `trem.mjs cards` separa os cards cujas PRs são todas
ancestrais do sha do corte, e a PR para a `main` sai de `release/v<AAAA.MM.DD>` nesse sha, não da
`dev` — o que entrar na `dev` depois fica para o próximo trem, e o que sobe é o que foi validado.
O **G5 é por trem**: os itens `[comando]` do `## Validação em dev` de cada PR rodam pela sessão,
numa worktree destacada no corte, com comando, saída e código colados na PR do trem; só os
`[humano]` vão ao humano, um card por pergunta. Depois do merge, todo card do trem vai para ✅
Produção com `Release` preenchido e a issue fechada (épico com todas as fases fechadas, idem), card
segurado sai do trem com o porquê, e a skill confere e registra `main..corte = 0`.

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

## A frente

**`/gm-frente <owner>/<repo>#<n> [texto da entrega]`** conduz um card, ou um épico inteiro, pela
esteira sem que ninguém digite o próximo comando: spec, tasks, implementação, PR e merge na dev.
Para quem lê de fora, o desenho cabe em cinco ideias.

**O condutor é um script; as estações são sessões.** A skill é fina: lança
`skills/gm-frente/frente.mjs` como um processo à parte (destacado, como um CI) e o acompanha com
chamadas de até 9 minutos. É o condutor que abre cada estação como `claude -p "/gm-<skill> …"` e lê a
última linha da saída, `PROXIMO:` ou `PARADA:` (`## Convenções de saída`). Subagente e workflow
salvo não servem: não rodam skill `gm-*`. Por isso a sessão do `/gm-frente` nunca espera CI nem
agenda retorno; quem espera o CI e as sessões é o condutor.

**A próxima estação vem dos artefatos, não do texto da `PROXIMO`.** A cada volta o condutor lê o
card, os comentários `gm:*`, as tasks na worktree e a PR, e a primeira linha que casa vale: PR
mergeada → unidade concluída; PR aberta → espera o CI e abre `/gm-ship --merge`; sem spec →
`/gm-spec`; spec e sem tasks → `/gm-plan-tasks`; task `❌` → as ondas; todas `✅` e sem PR →
`/gm-ship`. Sessão que fecha em `PARADA` deixa **aquela unidade** parada e as outras seguem.

**Unidade é um card, ou cada fase promovida de um épico.** Fase sem `Bloqueado` e com `gm:spec-ref`
anda ao mesmo tempo que as outras, cada uma na sua worktree (`<workspace>/<repo>-<n>-<slug>`); as
demais entram como `puladas`, com o porquê. Uma trava por unidade no `git-common-dir` impede duas
frentes sobre a mesma fase. Até `Paralelo` sessões filhas correm juntas (item do `CLAUDE.md`,
padrão 3), e no máximo **um `/gm-ship` por repo de cada vez**, para que dois merges na `dev` não
testem cada um sem o outro.

**Ondas.** O `/gm-plan-tasks` escreve, nas linhas 2 a 4 de cada task, `Onda:`, `Depende de:` e
`Toca:`; `ondas.mjs --validar` confere o plano (ids únicos, dependência em onda menor, nenhuma
colisão de caminhos dentro da onda). Onda de uma task roda na worktree da unidade. Onda de duas ou
mais abre uma worktree e uma branch por task (`<branch>-t<id>`), todas ao mesmo tempo, e o condutor
as junta com `git merge --no-ff`: o `Toca:` é o que garante junção limpa, e conflito para a
unidade com os arquivos. Junção feita, o condutor remove a worktree (sem `--force`) e a branch
(`-d`), dá o push e marca os checkboxes do `gm:tasks`, um por vez. Task antiga, sem os três campos,
roda em sequência na worktree da unidade, uma sessão por task.

**Estado e retomada.** Tudo vive em `${CLAUDE_CONFIG_DIR:-~/.claude}/gm-frente/<owner>-<repo>-<n>/`:
`estado.json` (de máquina, `versao: 1`, troca atômica), `entrega.txt`, e por sessão `prompt-*.txt`,
`saida-*.json` e `erro-*.txt`. “Condutor vivo” é um batimento de menos de 90 s, não um `pid`, que o
sistema reaproveita. Condutor morto → `iniciar` de novo: sessão com `pid` vivo é esperada, task `✅`
não é reaberta, unidade `parada` continua parada (a menos de `--reabrir`). A sessão filha é julgada
pelo JSON que escreveu, nunca pelo código de saída, porque a filha adotada na retomada não tem pai
para ler o código; passou de `--limite-min` (120), leva `SIGTERM` e a unidade para.

**O que cada sessão filha recebe.** Um prompt gerado num molde fixo: a skill e o argumento da
gramática (`<pasta> --card <n> --branch <b> --task <arquivo>`), o card e a spec, onde trabalhar, o
aviso de que outras sessões correm em worktrees irmãs, e a **entrega** em palavras, copiada literal.
Freios, trailer do commit e suíte **não** estão ali: vêm do `## Modo despachado` das skills e do
`CLAUDE.md` do repo. Daí que rodar um card não exija arquivo de despacho nenhum, só o texto da
entrega.

**Onde a frente termina.** Na `dev`, com a PR mergeada e o card em 🧪 Validação em Dev. Ela não faz
merge na `main`, tag nem release: isso é o `/gm-release`, que fica inteiro fora do modo despachado.
Spec sensível também termina em `PARADA` (`spec sensível; o merge … espera o humano`), porque o
merge sozinho na dev só vale para spec não sensível.

## Qual modelo roda cada estação

Cada skill declara no próprio frontmatter o modelo em que roda (`model:`), escolhido pelo que a
estação entrega: **Opus** onde sai documento que outros executam ao pé da letra ou onde se julga um
artefato ou uma ação sem volta, **Sonnet** onde se lê ou se executa o que já foi decidido.

Esta tabela é a fonte da verdade, e `node scripts/prova-modelo.mjs` confere que os treze `SKILL.md` —
no repo e na instalação — dizem o mesmo que ela. Mudou uma linha aqui? Mude o frontmatter junto, rode
`./sync.sh push` e depois `node scripts/prova-modelo.mjs --viva`.

| Skill | Modelo | Por quê |
|---|---|---|
| `gm-triage` | `claude-sonnet-5-5` | classifica e deduplica; volume alto, nada sai dela como contrato |
| `gm-explore` | `claude-sonnet-5-5` | só lê código e responde com evidência |
| `gm-card` | `claude-opus-5-5` | escreve os critérios de aceite que o resto da esteira herda |
| `gm-prd` | `claude-opus-5-5` | documento de produto que a spec vai seguir ao pé da letra |
| `gm-spec` | `claude-opus-5-5` | o contrato que o implementador executa literalmente |
| `gm-frente` | `inherit` | skill fina que lança o condutor e relata; nenhuma estação roda nela, cada filha usa o modelo da própria skill |
| `gm-tech-spec` | `inherit` | deprecated: só manda usar `/gm-spec`, e não vale trocar de modelo para isso |
| `gm-plan-tasks` | `claude-opus-5-5` | cada task é o prompt inteiro de um agente novo; o recorte é julgamento |
| `gm-implement` | `claude-sonnet-5-5` | executa uma task já decidida; é a estação que mais roda |
| `gm-ship` | `claude-sonnet-5-5` | roda a suíte e monta a PR a partir do que já existe |
| `gm-correcao` | `claude-opus-5-5` | julga cada achado do review contra a spec |
| `gm-release` | `claude-opus-5-5` | reconcilia a fila e conduz merge e tag, que não têm volta |
| `gm-hotfix` | `claude-opus-5-5` | emergência em produção: diagnóstico sob pressão e ações sem volta |

Ids completos, e não apelidos (`sonnet`, `opus`): a skill roda exatamente o modelo da tabela até
alguém mudar a linha, e trocar de geração é um commit com prova nova — nunca uma troca silenciosa.
Exige Claude Code 2.1.287 ou mais novo, a versão em que a geração 5.5 foi provada.

### Quanto tempo o modelo da skill vale

O `model:` troca o modelo **até o seu próximo prompt livre**, e não é salvo em settings.

- Dentro do turno, a skill segue no modelo dela a cada chamada de ferramenta e a cada resultado.
- A resposta que você dá pelo `AskUserQuestion` chega como resultado de ferramenta, no mesmo turno,
  então uma `/gm-spec` inteira fica no Opus enquanto a conversa passar pelas perguntas dela. Isto é
  dedução: foi medido que a resposta chega no mesmo turno e que o modelo da skill atravessa
  resultados de ferramenta, mas não as duas coisas juntas.
- Mensagem digitada livremente encerra o turno, e apertar Esc no meio de uma pergunta para escrever
  outra coisa também. Dali em diante vale o modelo da sessão, mesmo no meio da `/gm-spec`: a
  resposta a um "por que isso?" e tudo o que vier depois rodam nele.
- Para voltar ao modelo da estação, invoque a skill de novo. Ela é carregada outra vez e recomeça o
  procedimento dela, com o que já está na conversa como contexto.

### Trocar de modelo custa cache

O cache de prompt é separado por modelo. Numa sessão que já carregou muito contexto, a primeira
resposta da skill lê tudo sem cache no modelo dela, e na volta ao modelo da sessão o que estava em
cache antes da skill só é aproveitado se ainda não tiver expirado. Numa sessão longa, isso come a
economia que motivou declarar o modelo. Por isso, **quando a sessão atual já estiver longa, abra a
estação numa sessão nova**: é a orientação que o caminho acima dá ao `/gm-implement`, agora valendo
para todas.

### Quando o modelo declarado não é usado

A sessão fica no modelo em que está, sem erro, quando:

- ela roda em **auto mode** (ou em plan mode com o classificador) e o modelo declarado não é
  suportado por ele — na API da Anthropic, Haiku e Sonnet/Opus anteriores ao 4.6;
- o id está fora do `availableModels` da organização.

Em Bedrock, Google Cloud's Agent Platform, Foundry ou atrás de um gateway, o Claude Code repassa o id
sem conferir, e é o provedor quem decide o que fazer com um id que não serve. Quem usa outro provedor
troca a tabela, o frontmatter e a lista `IDS` do topo de `scripts/prova-modelo.mjs` pelos ids de lá, e
roda a prova.

## Como as skills perguntam

Toda skill `gm-*` com ponto de interação carrega, logo depois da prosa de missão, um bloco
`## Como perguntar e como aprovar` — carimbado byte a byte, a partir de `skills/_comum/convencoes.md`,
em toda skill que tem um. Esta é a versão longa dele, para ler de fora da esteira; se as duas
divergirem, a das skills é a que roda.

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

## Convenções de saída

Toda skill com ponto final (hoje todas menos `gm-tech-spec`) carrega o mesmo bloco no fim, carimbado
da mesma fonte:

- **A última linha da resposta é legível por máquina**: `PROXIMO: /gm-<skill> <argumento>` quando a
  esteira continua, ou `PARADA: <motivo em uma frase>` quando não. Quem despacha (um script, outra
  sessão) encadeia sem ler prosa.
- **Conteúdo de arquivo não viaja em argumento de comando.** Arquivo novo: `Write`; existente:
  `Edit`; heredoc só curto — o hook de custo de contexto nega acima de 1500 caracteres. Corpo longo
  (comentário, PR, commit) vai para um arquivo e daí para `--body-file` ou `git commit -F`.
- **Regra de um workspace não entra na skill.** O comando de typecheck do CI e a existência de
  segundo humano são lidos do `CLAUDE.md` do workspace; se não estiverem lá, a skill pergunta.
- **Despachado, não espera CI nem agenda retorno.** O `gm-correcao` roda uma vez por PR e não pede
  nova revisão; "entregue" no `gm-ship` exige CI verde e revisão tratada, e card validado em dev
  fecha na hora.

**Uma fonte, várias cópias.** Os três blocos (os dois acima e o `## Modo despachado`, abaixo) vivem em `skills/_comum/convencoes.md`;
`node scripts/skills-comum.mjs` carimba as seções na skill que tem os cabeçalhos — todos ou nenhum —, e `--check` acusa
cópia divergente ou skill com parte dos cabeçalhos — é a suíte do `/gm-ship` para mudança em `skills/`. Carimbar, e não citar: medido
em 2026-10-12, nenhuma das 480 sessões `/gm-*` do mantenedor leu o doc que o bloco citava, e
`@arquivo` dentro de `SKILL.md` só expande com caminho absoluto ou relativo ao `cwd`, calando quando
não acha. Regra que a sessão precisa seguir fica no texto da skill; a fonte única garante que ela
seja escrita uma vez.

## Modo despachado

Para quem lê de fora: é a seção que diz o que uma skill decide sozinha quando ninguém está na
sessão. Antes dela, cada despacho repetia no argumento os freios, o formato da última linha e a
identidade do commit — e cada pasta de despacho divergia das outras.

**Quando vale — as duas condições juntas.** Não há humano na sessão (`claude -p`, subagente) **e**
o argumento entrega a frente em palavras ("você decide sozinho o G2, o G3, o commit e o ship").
Sem humano e sem entrega, vale o item 5 de `## Como as skills perguntam`: parar e relatar. Com
humano, nunca vale, diga o argumento o que disser. O argumento pode acrescentar paradas; nunca
transforma um **para** em **decide** — salvo a linha do segundo revisor, e só nomeando-a.

**As três colunas.** *Decide*: aprovar artefato do próprio card (depois da crítica que a skill
exige), escolher entre os caminhos que a skill oferece, commit e push na branch do card, o **merge na
dev da PR do próprio card** (só quando o `merge-dev.mjs` devolve `pode: true`; spec sensível ou
condição falhando para, dizendo qual), a base `dev` da PR (outra só com `Motivo da base:` na spec) e
remover, sem `--force`, a worktree e a branch de task que a frente criou depois de juntá-la. *Para*:
o segundo revisor de spec sensível — salvo quando o argumento autoriza seguir sem ele, por nome (o
de IA roda igual), e é a única parada que o argumento pode abrir; no workspace que declara não ter
segundo humano a pergunta nem existe —, alvo ambíguo, escolha de produto que nada
registrado responde, desvio da spec, teste vermelho ou ambiente quebrado, e tudo que leva a
produção — merge **na `main`**, tag, release, deploy, instalação viva, apagar; `gm-release` e
`gm-hotfix` ficam inteiras aqui. A `PARADA` de spec sensível (“o merge na dev espera o humano”) não
tem linha **para** própria: é um gate que espera humano, e o classificador a põe em `gate-aberto`.
*Não faz*: esperar CI, agendar retorno, rodar em segundo plano (o condutor do `/gm-frente` é um
processo à parte, e é ele quem espera o CI e as sessões), devolver
comando `/gm-*` para alguém digitar (vai na linha `PROXIMO:`) e perguntar o que o card, a spec ou o
cofre já respondem.

**Todo decide é registrado na hora**: a ferramenta de decisão do workspace (`lembrar`, onde o MCP
`brain` roda), com o quê, o porquê e o descartado, e um comentário no card por etapa.

**O que o argumento ainda carrega**: card e repo, onde trabalhar (worktree, branch, base da PR
empilhada), as decisões registradas que o obrigam, paradas além da tabela e fatos de ambiente que o
`CLAUDE.md` não declara. Medido: o texto-base do despacho da #29 caiu de 2.871 para 1.718 bytes sem
perder nada que a tabela não diga.

**A parada classificada (opcional, atrás da flag do Jev).** Quem despacha pode passar a saída da
sessão por `node "$REPO/scripts/classificar-parada.mjs"`, com `$REPO` igual ao caminho absoluto do
checkout do `claude-brain` (nesta máquina, `~/pessoal/claude-brain`), definido pelo próprio script
de despacho. O caminho é absoluto porque o script não é instalado pelo `sync.sh`: roda do checkout,
e a orquestradora roda da raiz do workspace, onde `node scripts/…` dá `MODULE_NOT_FOUND`, código `1`,
e cai calado na leitura de sempre. O script lê do stdin, pega a última linha e escreve uma linha
JSON com cinco campos:
- `estado`: `classificada`, `sem-classificacao` ou `desligado`;
- `categoria`: o id de uma das linhas **para** da tabela do `## Modo despachado` de
  `skills/_comum/convencoes.md`, ou `gate-aberto`, ou `outro`;
- `probabilidade`;
- `escala`;
- `porque`.

`escala: true` é escalada obrigatória. Acontece em parada reservada ao humano (`producao`,
`escolha-de-produto`), em `outro`, em confiança abaixo do limiar, em erro ou tempo esgotado do
Jev, em resposta inválida, quando aquela tabela diverge da lista do script e quando quem respondeu
foi o cliente falso do #42 (`BRAIN_JEV_FALSO` definida, mesmo vazia: `porque: "falso"`). `escala: false`
deixa a categoria para a política da orquestradora, que não mora neste repo. `desligado` (sem a
flag ou sem a chave do cliente do Jev, do #42) e código de saída diferente de `0` querem dizer a
mesma coisa: ler a frase como sempre. A stdin é o texto já terminado (um arquivo, um `printf`), e
não a sessão ao vivo: se ela não fechar em 5 s, o script sai com código `2`. A linha `PARADA:` não
muda. A categoria é inferida, e a sessão nunca a declara.

**Não ligue o uso `parada` em `BRAIN_JEV` antes do CA4 do #44.** A categoria `gate-aberto` descreve,
ao pé da letra, toda `PARADA` (a convenção manda fechar com o gate deixado aberto), e pode absorver
uma parada reservada (`producao`, `escolha-de-produto`) com confiança alta, que então sai
`escala: false`. O CA4 mede essa confusão com as `PARADA` reais; até ele rodar, com o aval do
Leonardo para mandar os motivos ao Jev, o classificador fica desligado.

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

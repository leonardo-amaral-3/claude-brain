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
     │  🎯 Especificação    aprovação humana explícita, publicada no card
     ▼
/gm-plan-tasks  6–8 tasks independentes; cada arquivo de task é o prompt
     │  🎯                  completo de um agente novo
     ▼
/gm-implement   uma task por vez, de preferência em sessão nova:
     │  🔨 Implementação    branch certo, testes ANTES de apresentar,
     │                      commit só após aprovação
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
adversarial e liberada por aprovação humana explícita. Publicada como comentário no card, para que
os passos seguintes a encontrem no GitHub.

É **spec viva**: emenda aprovada durante a implementação (protocolo de desvio do `/gm-implement`)
atualiza o `spec.md` *e* o comentário, com nota datada. A spec publicada nunca vira mentira
histórica.

**`/gm-plan-tasks [pasta-da-feature]`** — quebra a spec em tasks ordenadas e independentes. Cada
arquivo de task é o **prompt completo** de um agente novo, que não viu a conversa. Propõe a
quebra inteira de uma vez para você vetar ou ajustar, respeita o teto de 6–8 tasks e espelha a
lista no card.

### Implementação

**`/gm-implement [pasta-da-feature]`** — executa **uma** task pendente, de preferência em sessão
nova. Branch certo no repo certo, criado ligado ao card pelo campo Development. O arquivo da task
é o prompt. Testes rodam **antes** de apresentar. Resumo ordenado por risco. Commit só depois de
aprovação explícita. Se a realidade contradiz a spec, entra o protocolo de desvio em vez de
improviso silencioso.

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

## A regra que sustenta tudo

Duas regras vão no `CLAUDE.md` do workspace (o template já traz as duas):

1. **O cérebro vem antes da exploração.** Antes de abrir arquivo na mão, rodar `Grep` ou lançar
   agente de exploração, consulte o `search_context`. Grep continua válido — só não como
   *primeiro* movimento.

2. **Registre a decisão na hora.** Decidiu algo? `mcp__brain__lembrar` naquele momento, com o
   **porquê** e o que foi descartado. Não espere o fim da sessão: se ela morrer antes, o porquê se
   perde — e o porquê é a única parte que ninguém reconstrói lendo o diff depois.

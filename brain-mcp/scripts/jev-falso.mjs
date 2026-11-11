// Substituto determinístico de `dist/juizJev.js`, SÓ para os testes. Injetado por
// embeddings-falso-hook.mjs; nenhum código de produção sabe que ele existe.
//
// Por que existe (#46): `lembrar` pergunta ao Jev, serviço externo pago, se a decisão nova contradiz
// cada vizinha. Os casos que sobem servidor de verdade precisam exercitar esse caminho sem que
// processo nenhum alcance a rede, qualquer que seja a flag ou a chave no ambiente de quem roda. O
// hook troca `dist/juizJev.js` por este arquivo em todo processo de teste.
//
// O que este falso NÃO enfraquece: ele devolve o que o contrato de `JulgarPar` permite (número,
// rejeição, silêncio que ignora o `signal`), então prazo, validação e "tudo ou nada" de
// `julgarContradicoes` são exercitados de verdade. Só o julgamento em si é de mentira.
//
// BRAIN_CONTRADICAO_FALSO (lido a CADA chamada de obterJulgarPar). Variável própria, e não o
// `BRAIN_JEV_FALSO` do cliente do #42: lá, definida quer dizer "cliente falso" e os valores são
// outros (`sim`/`nao`/`indisponivel`/`lento`/roteiro); e o `envSemJev` tira toda `BRAIN_JEV*` do
// ambiente dos filhos, o que apagaria o modo pedido pelo caso (G4 da PR #61, achados 5 e 6).
//   ausente | desligado -> null (Jev desligado)
//   ligado              -> após 10 ms devolve o número de `[p=<n>]` em `par.anterior`, ou 0.05
//   erro                -> rejeita
//   lento               -> ignora o `signal` e resolve 0.99 após 60 s (timer com unref)
// BRAIN_CONTRADICAO_FALSO_REGISTRO=<arquivo>: cada juiz anota `{ pid, par }` antes de agir; é o que prova
// o que sai do processo (R6) e quantas vezes o juiz foi chamado. Nunca escreve em stdout, que no
// servidor MCP é o JSON-RPC.

import { appendFileSync } from "node:fs";

const MARCADOR = /\[p=(0(?:\.\d+)?|1(?:\.0+)?)\]/;

function anotar(par) {
  const arquivo = process.env.BRAIN_CONTRADICAO_FALSO_REGISTRO;
  if (!arquivo) return;
  appendFileSync(arquivo, JSON.stringify({ pid: process.pid, par }) + "\n");
}

export async function obterJulgarPar() {
  const modo = process.env.BRAIN_CONTRADICAO_FALSO ?? "desligado";
  if (modo === "ligado") {
    return async (par) => {
      anotar(par);
      await new Promise((r) => setTimeout(r, 10));
      const achou = MARCADOR.exec(par.anterior);
      return achou ? Number(achou[1]) : 0.05;
    };
  }
  if (modo === "erro") {
    return async (par) => {
      anotar(par);
      throw new Error("jev falso: erro de propósito");
    };
  }
  if (modo === "lento") {
    return async (par) => {
      anotar(par);
      return new Promise((resolve) => {
        setTimeout(() => resolve(0.99), 60000).unref();
      });
    };
  }
  return null;
}

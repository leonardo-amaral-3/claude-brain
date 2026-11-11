// Limpa o ambiente do Jev antes de um script subir o servidor.
//
// Por que existe: o servidor que eval, smoke e concorrencia sobem pode carregar o cliente do Jev
// (o roteador de source), e o cliente le BRAIN_JEV e a chave do ambiente. Passar `envSemJev` ao
// proprio processo, uma vez, antes do primeiro spawn, cobre todo `...process.env` dos filhos e e
// o que mantem "medicao nao usa rede" verdadeiro numa maquina que um dia tiver a chave.
// A regra de quais chaves saem e do cliente (`hooks/jev.js`, C6): aqui nao se copia.
//
// Resolucao (C1, scripts): o layout do repo, depois o da instalacao.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * @param {string} raiz a pasta `brain-mcp` (a do script que chama)
 * @returns {{ caminho: string, cliente: object } | { erro: string }}
 */
export function semJev(raiz) {
  const doRepo = join(raiz, "..", "hooks", "jev.js");
  const dosHooks = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "hooks", "jev.js");
  const caminho = [doRepo, dosHooks].find((c) => existsSync(c));
  const erro = {
    erro: `cliente do Jev não encontrado em ${doRepo} nem em ${dosHooks} (ou ilegível): rode de dentro do repo ou com os hooks instalados`,
  };
  if (!caminho) return erro;
  let cliente;
  try {
    cliente = require(caminho);
  } catch {
    return erro;
  }
  if (!cliente || typeof cliente.envSemJev !== "function") return erro;
  // Apaga no lugar, e nao `process.env = ...`: o `process.env` do Node e um objeto especial (no
  // Windows a chave nao diferencia maiusculas, e toda escrita vira string), e uma copia comum perde
  // isso. A lista do que sai continua sendo a do cliente: sai o que o `envSemJev` nao devolveu.
  const limpo = cliente.envSemJev(process.env);
  for (const nome of Object.keys(process.env)) {
    if (!Object.hasOwn(limpo, nome)) delete process.env[nome];
  }
  return { caminho, cliente };
}

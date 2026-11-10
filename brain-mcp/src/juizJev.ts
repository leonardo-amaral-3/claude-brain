import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { criarJulgarPar, prazoJulgamentoMs, type JulgarPar } from "./contradicao.js";

// A única ponte com o cliente do Jev do #42 (`hooks/jev.js`, CommonJS). Nos testes este arquivo é
// trocado por scripts/jev-falso.mjs pelo hook de resolução (embeddings-falso-hook.mjs).
//
// Os tipos abaixo são só o pedaço do contrato do #42 que esta ponte usa; não se importa tipo de lá
// porque o cliente é JavaScript e mora fora do `brain-mcp/`.
interface RespostaJev {
  estado: string;
  tipo?: string;
  probabilidade?: number;
}

interface ModuloJev {
  ligado(uso: string): boolean;
  decidir(
    estado: string,
    perguntas: Record<string, { tipo: "noul"; instrucao: string }>,
    opcoes: { uso: string; timeoutMs: number },
  ): Promise<Record<string, RespostaJev | undefined>>;
}

// Última frase de `montarPergunta`, literal: é a pergunta `noul` que o Jev responde sobre o `estado`.
const PERGUNTA_CONTRADICAO = "A decisão nova contradiz a decisão anterior, isto é, as duas não podem valer ao mesmo tempo?";

// Ordem do contrato do #42: primeiro o layout do repo (e da worktree), depois o da instalação.
// Nenhum dos dois existe → `null`: o cliente não está instalado, o que não é erro.
function caminhoDoCliente(): string | null {
  const raizDoBrainMcp = join(dirname(fileURLToPath(import.meta.url)), "..");
  const doRepo = join(raizDoBrainMcp, "..", "hooks", "jev.js");
  if (existsSync(doRepo)) return doRepo;
  const daInstalacao = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "hooks", "jev.js");
  return existsSync(daInstalacao) ? daInstalacao : null;
}

export async function obterJulgarPar(): Promise<JulgarPar | null> {
  try {
    const caminho = caminhoDoCliente();
    if (caminho === null) return null;
    const jev = createRequire(import.meta.url)(caminho) as ModuloJev;
    return await criarJulgarPar({
      ligado: () => jev.ligado("lembrar"),
      // O contrato do #42 não aceita `signal`; o prazo vai em `timeoutMs` e a corrida do
      // `julgarContradicoes` continua valendo. `probabilidade` do `noul` é P(sim).
      perguntar: async (texto) => {
        const resposta = (
          await jev.decidir(texto, { contradiz: { tipo: "noul", instrucao: PERGUNTA_CONTRADICAO } }, { uso: "lembrar", timeoutMs: prazoJulgamentoMs() })
        )?.contradiz;
        return resposta?.estado === "ok" && resposta.tipo === "noul" && typeof resposta.probabilidade === "number"
          ? { resposta: "sim", probabilidade: resposta.probabilidade }
          : null;
      },
    });
  } catch (err) {
    console.error("[brain] contradicao: cliente do Jev indisponivel:", (err as Error).message);
    return null;
  }
}

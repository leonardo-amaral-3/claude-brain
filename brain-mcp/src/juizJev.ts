import type { JulgarPar } from "./contradicao.js";

// PROVISÓRIO (decisão #1418). O cliente do Jev do #42 ainda não tem código, então esta ponte não
// tem com o que se ligar: resolve `null`, que é exatamente o comportamento de R1 (Jev desligado,
// o aviso do `lembrar` sai como hoje). A task 4 do #46 troca este corpo pelo da spec
// (`### Fronteira com o #42`). Nos testes o hook de resolução já troca este arquivo por
// scripts/jev-falso.mjs.
export async function obterJulgarPar(): Promise<JulgarPar | null> {
  return null;
}

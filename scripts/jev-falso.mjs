// Substituto determinístico do cliente do Jev, SÓ para scripts/classificar-parada-teste.mjs (card #44).
// Nenhum código de produção o importa.
//
// Por que existe: o teste não pode chamar a API de verdade (não há chave nesta máquina, e mandar
// motivo de PARADA à TypeSafe AI não foi autorizado), e precisa de respostas previsíveis e de
// defeitos sob encomenda: erro, exceção síncrona, silêncio até o cancelamento, resposta fora do
// contrato. O falso tem a forma que o #44 espera do cliente (`ligado()` + `escolher(...)`); adaptar
// ao cliente real do #42 é o `daFormaDo42` da task 3, e não deste arquivo.
//
// A tabela de palavras-chave é o "classificador" do falso: a primeira que aparece no texto, na
// ordem, decide a categoria. É grosseira de propósito: o que o teste prova é a regra de escalada
// do #44, não a qualidade da classificação.

import { CATEGORIAS } from "./classificar-parada.mjs";

const PALAVRAS_CHAVE = [
  { palavra: "segundo revisor", id: "segundo-revisor", probabilidade: 0.93 },
  { palavra: "ambígu", id: "alvo-ambiguo", probabilidade: 0.91 },
  { palavra: "produto", id: "escolha-de-produto", probabilidade: 0.9 },
  { palavra: "desvio", id: "desvio-de-spec", probabilidade: 0.9 },
  { palavra: "vermelho", id: "teste-vermelho", probabilidade: 0.95 },
  { palavra: "merge", id: "producao", probabilidade: 0.97 },
  { palavra: "gate", id: "gate-aberto", probabilidade: 0.9 },
];
const SEM_PALAVRA = { id: "outro", probabilidade: 0.6 };

const textoDaCategoria = (id) => CATEGORIAS.find((categoria) => categoria.id === id).texto;

export function criarJevFalso({ defeito = null, probabilidade = null } = {}) {
  let chamadas = 0;

  const ligado = () => {
    if (defeito === "ligado-lanca") throw new Error("jev falso: ligado lançou");
    return defeito !== "desligado";
  };

  // Segura o event loop até o `signal` abortar, e só então rejeita. O `setInterval` é o que faria um
  // cliente real com o socket aberto: se o #44 não cancelar, o teste pendura em vez de passar calado.
  const esperarOCancelamento = (signal) =>
    new Promise((_resolve, rejeitar) => {
      const segurando = setInterval(() => {}, 1000);
      const cancelar = () => {
        clearInterval(segurando);
        rejeitar(new Error("jev falso: cancelado"));
      };
      if (signal.aborted) cancelar();
      else signal.addEventListener("abort", cancelar, { once: true });
    });

  // Função NÃO async de propósito: "lanca-sincrono" tem de lançar antes de devolver a promessa.
  const escolher = ({ texto, signal }) => {
    chamadas++;
    if (defeito === "lanca-sincrono") throw new Error("jev falso: lançou síncrono");
    if (defeito === "erro") return Promise.reject(new Error("jev falso: erro"));
    if (defeito === "tempo") return esperarOCancelamento(signal);
    if (defeito === "tempo-surdo") {
      // Ignora o `signal` e segura o processo: só o C9d usa, em processo filho, para provar que a CLI
      // termina mesmo assim.
      setInterval(() => {}, 1000);
      return new Promise(() => {});
    }
    if (defeito === "opcao-fora") return Promise.resolve({ opcao: "Categoria que não existe", probabilidade: 0.9 });
    if (defeito === "nao-objeto") return Promise.resolve(null);

    const minusculo = texto.toLowerCase();
    const achada = PALAVRAS_CHAVE.find(({ palavra }) => minusculo.includes(palavra)) ?? SEM_PALAVRA;
    if (defeito === "probabilidade-fora") {
      return Promise.resolve({ opcao: textoDaCategoria(achada.id), probabilidade: 1.5 });
    }
    return Promise.resolve({
      opcao: textoDaCategoria(achada.id),
      probabilidade: probabilidade ?? achada.probabilidade,
    });
  };

  return {
    ligado,
    escolher,
    get chamadas() {
      return chamadas;
    },
  };
}

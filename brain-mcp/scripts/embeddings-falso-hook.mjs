// Entrada de `node --import`: registra um hook de resolução ESM que troca `dist/embeddings.js`
// pelo stub determinístico de embeddings-falso.mjs. Ver o porquê lá.
//
// Um hook de resolução (e não uma cópia do dist/, nem monkey-patch) porque ESM não deixa
// substituir binding exportado de fora e porque a costura precisa valer do OUTRO lado de uma
// fronteira de processo — não há assinatura de função para costurar ali.

import { register } from "node:module";

const falso = new URL("./embeddings-falso.mjs", import.meta.url).href;

// O hook roda numa thread própria, então não enxerga as variáveis daqui: o caminho do stub vai
// embutido no fonte. Inline em data: URL para não precisar de um terceiro arquivo de duas linhas.
register(
  "data:text/javascript," +
    encodeURIComponent(
      `const falso = ${JSON.stringify(falso)};\n` +
        `export async function resolve(spec, ctx, next) {\n` +
        `  const r = await next(spec, ctx);\n` +
        `  if (r.url.endsWith("/dist/embeddings.js")) {\n` +
        `    return { url: falso, format: "module", shortCircuit: true };\n` +
        `  }\n` +
        `  return r;\n` +
        `}\n`
    )
);

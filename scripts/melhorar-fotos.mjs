// Mede as fotos do CraftenSKZ e grava no colecao.json o link da melhor foto de
// cada card (campos u e w). Não precisa do Supabase: trabalha em cima do
// colecao.json que já está no repositório. O cron faz o mesmo sozinho quando
// regenera o catálogo; este script serve pra rodar na mão (por exemplo, pra
// ver se a fonte publicou fotos que faltavam).
//
// Uso: npm run melhorar-fotos
import { readFileSync, writeFileSync } from "node:fs";
import { aplicarMelhoresFotos, lerMedidas } from "./catalogo-core.mjs";

const arq = new URL("../colecao.json", import.meta.url);
const colecao = JSON.parse(readFileSync(arq, "utf8"));
const medidas = lerMedidas();
const medidas_agora = await aplicarMelhoresFotos(colecao, medidas, { medir: "todos" });

const fotos = Object.fromEntries(Object.entries(medidas.fotos).sort());
writeFileSync(new URL("../data/catalogo-medidas.json", import.meta.url), JSON.stringify({ celula: medidas.celula, fotos }));
writeFileSync(arq, JSON.stringify(colecao));

const it = colecao.items;
console.log(`${medidas_agora} fotos medidas agora · ${it.filter((x) => x.u).length} cards com foto melhor que a da folha · ${it.filter((x) => (x.u || x.p) && x.w < 300).length} cards com foto abaixo de 300px · ${it.filter((x) => !x.u && !x.p).length} sem foto`);

// Caça de fotos: procura fotos boas (só o link) pros cards sem foto boa e grava
// como SUGESTÃO em fotosug/<id do card>. O robô nunca troca uma foto que ela
// escolheu; ela aprova ou descarta no app (Coleção > Sem foto).
//
// Precisa de SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e OWNER_ID.
//
// Uso:
//   node scripts/sync-fotos.mjs                 (dry-run: só conta e mostra)
//   node scripts/sync-fotos.mjs --apply         (grava as sugestões)
//   --todos       o catálogo inteiro (padrão: só os cards dela)
//   --limite=N    no máximo N cards por rodada (padrão 400)
//   --offline     sem rede nas fontes e sem banco (usa só colecao.json + data/fotos-extra.json), pra testar
import { readFileSync } from "node:fs";
import { cacarFotos, cardsDela, lerDocs, gravarDocs, wikiJson } from "./fotos-core.mjs";
import { buscarPocamarketStrayKids } from "./migrar-pocamarket.mjs";

const lerJson = (p, pad) => { try { return JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")); } catch { return pad; } };

export async function rodar({ apply = false, todos = false, limite = 400, offline = false, url, key, owner } = {}) {
  const colecao = lerJson("../colecao.json", { items: [] });
  const extra = lerJson("../data/fotos-extra.json", {});
  let fotos = {}, sug = {}, itens = {}, posse = {}, loja = [];
  if (!offline) {
    if (!url || !key || !owner) throw new Error("Faltam SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e/ou OWNER_ID.");
    [fotos, sug, itens, posse] = await Promise.all(["fotos", "fotosug", "itens", "colecao"].map((c) => lerDocs(url, key, owner, c)));
    try { loja = await buscarPocamarketStrayKids(); } catch (e) { console.warn("POCA MALL fora do ar:", e.message); }
  }
  const cards = todos || offline ? colecao.items : cardsDela(colecao, itens, posse);
  const r = await cacarFotos({ colecao, cards, fotos, sug, loja, extra, limite, fetchJson: offline ? async () => ({}) : wikiJson });
  if (apply && r.linhas.length) await gravarDocs(url, key, owner, "fotosug", r.linhas);
  return { ...r, apply, escopo: todos || offline ? "catálogo inteiro" : "cards dela" };
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2);
  const limite = Number((a.find((x) => x.startsWith("--limite=")) || "").split("=")[1]) || 400;
  rodar({ apply: a.includes("--apply"), todos: a.includes("--todos"), offline: a.includes("--offline"), limite, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, owner: process.env.OWNER_ID })
    .then((r) => {
      console.log(`Escopo: ${r.escopo}. Na fila: ${r.resumo.naFila}. Com candidato: ${r.resumo.comCandidato}. Sem candidato: ${r.resumo.semCandidato}.`);
      console.log("Por fonte (cards com ao menos 1 candidato dessa fonte):", r.resumo.porFonte);
      for (const [id, s] of r.linhas.filter(([, s]) => s.c.length).slice(0, 15)) console.log(`  ${id}: ${s.c.map((x) => `${x.fonte} ${x.nota}`).join(", ")}`);
      console.log(r.apply ? `Gravado: ${r.linhas.length} linha(s) em fotosug.` : "Dry-run: nada foi gravado. Rode com --apply.");
    })
    .catch((e) => { console.error("Falhou:", e.message); process.exitCode = 1; });
}

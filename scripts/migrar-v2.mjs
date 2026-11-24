// Migra os dados do app atual (tabela "docs") para as tabelas novas
// (supabase/v2.sql). Não apaga nem muda nada em "docs".
//
//   npm run migrar-v2              só mostra o relatório (não grava nada)
//   npm run migrar-v2 -- --apply   grava as tabelas novas
//
// Rodar de novo é seguro: registro que já existe nas tabelas novas é
// ignorado (nunca sobrescreve o que você já editou no app novo).
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID
// (Supabase > Authentication > Users > User UID).
import { readFileSync } from "node:fs";
import { mapear, ORDEM } from "./v2/mapear.mjs";

const { SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY, OWNER_ID: OWNER } = process.env;
const aplicar = process.argv.includes("--apply");
if (!URL_ || !KEY || !OWNER) {
  console.error("Faltam variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e OWNER_ID.");
  process.exit(1);
}

async function rest(path, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${path.split("?")[0]}: HTTP ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t.trim() ? JSON.parse(t) : null;
}

async function lerDocs() {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const pg = await rest(`docs?owner=eq.${OWNER}&select=col,id,data&order=col,id`, { headers: { Range: `${de}-${de + 999}` } });
    out.push(...pg);
    if (pg.length < 1000) return out;
  }
}

const docs = await lerDocs();
const colecao = JSON.parse(readFileSync(new URL("../colecao.json", import.meta.url), "utf8"));
const { tabelas, relatorio: r } = mapear(docs, { cardIds: new Set(colecao.items.map((c) => c.i)) });

const lista = (xs) => (xs.length ? [...new Set(xs)].join("; ") : "nenhuma");
console.log(`Li ${docs.length} registros do app atual.\n`);
console.log("Vai para as tabelas novas:");
for (const k of ORDEM) console.log(`  ${k.padEnd(12)} ${r.contagem[k]}`);
console.log(`\nItens sem card do catálogo: ${r.itensSemCard}`);
console.log(`Cards com cópia repetida: ${r.repetidos}`);
console.log(`Registros com pix ou caminho de comprovante (ficam só no app antigo): ${r.semPix}`);
console.log(`Comunidades criadas porque eram citadas sem cadastro: ${lista(r.criadas.comunidades)}`);
console.log(`CEGs criadas porque eram citadas sem cadastro: ${lista(r.criadas.cegs)}`);
console.log(`GOMs que só apareciam em CEG ou envio: ${lista(r.criadas.goms)}`);
console.log(`CEGs com o mesmo nome em mais de uma comunidade (conferir): ${lista(r.cegAmbigua)}`);
console.log(`Valores que não consegui ler: ${lista(r.valoresEstranhos)}`);
console.log(`Fica só no app antigo: caixa ${r.fora.caixa}, meta ${r.fora.meta}, outros ${r.fora.outros}`);

if (!aplicar) {
  console.log("\nNada foi gravado. Para gravar: npm run migrar-v2 -- --apply");
  process.exit(0);
}

for (const k of ORDEM) {
  // o Supabase exige as mesmas chaves em todas as linhas de uma gravação
  const chaves = [...new Set(tabelas[k].flatMap(Object.keys))];
  const linhas = tabelas[k].map((x) => ({ ...Object.fromEntries(chaves.map((c) => [c, null])), ...x, owner: OWNER }));
  const conflito = k === "card_fotos" ? "owner,card_id" : "id";
  for (let i = 0; i < linhas.length; i += 500) {
    await rest(`${k}?on_conflict=${conflito}`, {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(linhas.slice(i, i + 500)),
    });
  }
  console.log(`gravado: ${k} (${linhas.length})`);
}
console.log("\nPronto. O app atual continua igual; as tabelas novas estão preenchidas.");

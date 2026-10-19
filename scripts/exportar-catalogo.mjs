// Regenera o colecao.json local a partir do Supabase (catalogo_itens) + das
// folhas de fotos fixas (data/catalogo-fotos.json). Útil pra testar/revisar
// localmente antes de comitar; o cron (api/cron/sync-catalogo.js) faz o
// mesmo e já comita direto no GitHub.
//
// Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.
//
// Uso: node scripts/exportar-catalogo.mjs

import { writeFileSync } from "node:fs";
import { gerarColecaoJson } from "./catalogo-core.mjs";

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");

  const colecao = await gerarColecaoJson(url, key);
  writeFileSync(new URL("../colecao.json", import.meta.url), JSON.stringify(colecao));
  console.log(`colecao.json regenerado: ${colecao.items.length} itens.`);
}

main().catch((err) => { console.error("Falhou:", err.message); process.exitCode = 1; });

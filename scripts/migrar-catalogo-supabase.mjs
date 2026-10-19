// Migração única: lê o colecao.json atual (como está hoje, com todos os
// itens e as folhas de fotos) e grava os itens na tabela catalogo_itens do
// Supabase, preservando a posição salva na folha de fotos (campo "p") de
// cada um. Depois disso, colecao.json passa a ser gerado a partir do
// Supabase (scripts/exportar-catalogo.mjs ou o cron), não editado à mão.
//
// Roda uma vez só. Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no
// ambiente.
//
// Uso: node scripts/migrar-catalogo-supabase.mjs

import { readFileSync } from "node:fs";

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");

  const atual = JSON.parse(readFileSync(new URL("../colecao.json", import.meta.url), "utf8"));
  const linhas = atual.items.map((it) => ({
    i: it.i, m: it.m, e: it.e, o: it.o, t: it.t, v: it.v, s: it.s || null, p: it.p || null,
  }));

  const lote = 500;
  for (let i = 0; i < linhas.length; i += lote) {
    const parte = linhas.slice(i, i + lote);
    const r = await fetch(`${url}/rest/v1/catalogo_itens`, {
      method: "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(parte),
    });
    if (!r.ok) throw new Error(`Supabase: HTTP ${r.status} ${await r.text()}`);
    console.log(`${Math.min(i + lote, linhas.length)}/${linhas.length} itens migrados...`);
  }
  console.log("Migração concluída.");
}

main().catch((err) => { console.error("Falhou:", err.message); process.exitCode = 1; });

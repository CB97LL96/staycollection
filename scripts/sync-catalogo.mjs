// Confere se o CraftenSKZ (StrayKidsPCCollector) ganhou item novo e grava no
// Supabase (catalogo_itens). Só adiciona: nunca remove ou reescreve um item
// que já existe, pra não perder a posição salva na folha de fotos nem mudar
// o id de nada já ligado a uma coleção.
//
// Depois de gravar, roda `npm run exportar-catalogo` (ou deixa o cron fazer
// isso) pra atualizar o colecao.json que o app realmente lê.
//
// Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (a chave
// service_role fica em Supabase > Project Settings > API — NUNCA no
// config.js nem em lugar que o navegador carregue).
//
// Uso:
//   node scripts/sync-catalogo.mjs            (dry-run)
//   node scripts/sync-catalogo.mjs --apply     (grava no Supabase)

import { buscarNovosCraftenSKZ, supabaseIdsConhecidos, supabaseInserirItens } from "./catalogo-core.mjs";

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");

  const idsConhecidos = await supabaseIdsConhecidos(url, key);
  const novos = await buscarNovosCraftenSKZ(idsConhecidos);

  if (!novos.length) {
    console.log("Nada novo: o catálogo já tem tudo que está no CraftenSKZ agora.");
    return;
  }

  console.log(`${novos.length} item(ns) novo(s) encontrado(s):`);
  for (const it of novos.slice(0, 30)) console.log(`  [${it.o}/${it.t}] ${it.e} · ${it.m} — ${it.v} (${it.i})`);
  if (novos.length > 30) console.log(`  ...e mais ${novos.length - 30}.`);

  if (!apply) {
    console.log("\nDry-run: nada foi gravado. Roda com --apply pra gravar no Supabase.");
    return;
  }

  await supabaseInserirItens(url, key, novos);
  console.log("\nGravado no Supabase. Roda 'npm run exportar-catalogo' pra atualizar o colecao.json local a partir do banco (ou deixa o cron fazer isso automaticamente).");
}

main().catch((err) => { console.error("Falhou:", err.message); process.exitCode = 1; });

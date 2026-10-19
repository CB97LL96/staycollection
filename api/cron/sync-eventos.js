// Cron do Vercel: reimporta a linha do tempo (planilha "SKZ Era Timeline")
// e a wiki (Season's Greetings + Merch events) pra catalogo_eventos. Essas
// fontes mudam bem menos que o CraftenSKZ, por isso roda semanal (não
// diário) — ver o schedule em vercel.json.
//
// Diferente de api/cron/sync-catalogo.js: não precisa comitar nada no
// GitHub, porque catalogo_eventos ainda não vira colecao.json (é consultado
// direto do Supabase quando o app precisar).
//
// Variáveis de ambiente: as mesmas do api/cron/sync-catalogo.js
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET).
import { importarEventosTimeline } from "../../scripts/migrar-eventos-timeline.mjs";
import { importarWikiSkz } from "../../scripts/migrar-wiki-skz.mjs";

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ erro: "Faltam variáveis de ambiente do Supabase." });

  try {
    const totalTimeline = await importarEventosTimeline(url, key);
    const wiki = await importarWikiSkz(url, key);
    return res.status(200).json({ timeline: totalTimeline, wiki });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
}

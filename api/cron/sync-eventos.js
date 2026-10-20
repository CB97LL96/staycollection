// Cron do Vercel: reimporta a linha do tempo (planilha "SKZ Era Timeline"),
// a wiki (Season's Greetings + Merch events) pra catalogo_eventos, e preço/
// link da Stray Kids na POCA MALL pra catalogo_loja. Essas fontes mudam bem
// menos que o CraftenSKZ, por isso roda semanal (não diário) — ver o
// schedule em vercel.json. A POCA MALL entrou aqui (em vez de um cron só
// dela) pra não passar do limite de cron jobs do plano Hobby da Vercel.
//
// Diferente de api/cron/sync-catalogo.js: não precisa comitar nada no
// GitHub, porque catalogo_eventos e catalogo_loja ainda não viram
// colecao.json (são consultados direto do Supabase quando o app precisar,
// por api/eventos.js e api/loja.js).
//
// Variáveis de ambiente: as mesmas do api/cron/sync-catalogo.js
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET).
import { importarEventosTimeline } from "../../scripts/migrar-eventos-timeline.mjs";
import { importarWikiSkz } from "../../scripts/migrar-wiki-skz.mjs";
import { importarPocamarket } from "../../scripts/migrar-pocamarket.mjs";

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ erro: "Faltam variáveis de ambiente do Supabase." });

  try {
    const totalTimeline = await importarEventosTimeline(url, key);
    const wiki = await importarWikiSkz(url, key);
    let loja;
    try { loja = await importarPocamarket(url, key); } catch (e) { loja = { erro: e.message }; }
    return res.status(200).json({ timeline: totalTimeline, wiki, loja });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
}

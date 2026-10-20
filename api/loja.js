// Lê catalogo_loja (preço e link de itens da Stray Kids à venda na POCA
// MALL) pro app mostrar na aba Loja da Coleção. Mesma postura de api/
// eventos.js: dado de referência público, só service_role escreve (cron
// semanal, api/cron/sync-eventos.js), esta rota só lê e não precisa de
// autenticação.
//
// Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ erro: "Faltam variáveis de ambiente do Supabase." });

  const select = "nome,preco_usd,preco_lista_usd,link,imagem,categoria,pre_order_em,fonte,atualizado_em";
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    const r = await fetch(`${url}/rest/v1/catalogo_loja?select=${select}&order=nome`, { headers });
    if (!r.ok) throw new Error(`Supabase: HTTP ${r.status} ${await r.text()}`);
    const itens = await r.json();
    res.setHeader("Cache-Control", "public, max-age=1800");
    return res.status(200).json({ itens });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
}

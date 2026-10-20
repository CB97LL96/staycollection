// Lê catalogo_eventos (Season's Greetings, pop-up/merch events e a linha do
// tempo da planilha "SKZ Era Timeline") pro app mostrar na aba Eventos da
// Coleção. Dado de referência pública, igual ao catálogo de photocards: só a
// chave service_role escreve (cron semanal, api/cron/sync-eventos.js); esta
// rota só lê e não precisa de autenticação.
//
// Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (as mesmas
// já usadas pelos crons do catálogo).
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ erro: "Faltam variáveis de ambiente do Supabase." });

  const select = "evento,tipo,data_inicio,data_inicio_raw,data_fim,data_fim_raw,pais,cidade,notas,aba_origem";
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const pagina = 1000;

  try {
    const eventos = [];
    for (let offset = 0; ; offset += pagina) {
      const r = await fetch(`${url}/rest/v1/catalogo_eventos?select=${select}&offset=${offset}&limit=${pagina}`, { headers });
      if (!r.ok) throw new Error(`Supabase: HTTP ${r.status} ${await r.text()}`);
      const lote = await r.json();
      eventos.push(...lote);
      if (lote.length < pagina) break;
    }
    res.setHeader("Cache-Control", "public, max-age=1800");
    return res.status(200).json({ eventos });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
}

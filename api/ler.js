// Lê uma mensagem ou print (WhatsApp, planilha, site da GOM) e sugere
// registros pro app: cobranças, itens, envios e repasses.
// Roda no Vercel. Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   GEMINI_API_KEY  chave do Google AI Studio (ver scripts/ia.mjs)
//   SUPABASE_URL, SUPABASE_ANON_KEY  os mesmos do config.js
//   ALLOWED_EMAILS  e-mails que podem usar, separados por vírgula
//   MEUS_NOMES  como você aparece nas planilhas e grupos, separados por vírgula
import { lerFonte, IMAGENS } from "../scripts/ler-core.mjs";

async function permitido(req){
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL) return false;
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return false;
  const u = await r.json();
  const emails = (process.env.ALLOWED_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return emails.includes((u.email || "").toLowerCase());
}


export default async function handler(req, res){
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!await permitido(req)) return res.status(401).json({ erro: "Entre com a sua conta pra usar a leitura." });

  const { fonte = "", imagem = null, contexto = {} } = req.body || {};
  if (!fonte.trim() && !imagem) return res.status(400).json({ erro: "Mande um texto ou uma imagem." });
  if (imagem && !IMAGENS.includes(imagem.tipo)) return res.status(400).json({ erro: "Formato de imagem não suportado." });

  try {
    return res.status(200).json(await lerFonte({ fonte, imagens: imagem ? [imagem] : [], contexto }));
  } catch (e) {
    if (e.codigo === "recusa") return res.status(422).json({ erro: e.message });
    if (e.codigo === "grande_demais") return res.status(422).json({ erro: e.message + " Tente um trecho menor." });
    if (e.codigo === "limite") return res.status(429).json({ erro: e.message });
    if (e.codigo === "sem_chave" || e.codigo === "chave_errada") return res.status(500).json({ erro: e.message });
    if (typeof e.status === "number") return res.status(502).json({ erro: `A API do Gemini falhou (${e.status}). Tente de novo.` });
    console.error(e);
    return res.status(500).json({ erro: "Erro inesperado na leitura." });
  }
}

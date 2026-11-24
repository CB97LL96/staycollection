// Colar print: acha cada card num print. Mesma autenticação do api/ler.js.
// Variáveis: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_EMAILS.
import { lerPrint } from "../scripts/print-core.mjs";
import { IMAGENS } from "../scripts/ler-core.mjs";

async function permitido(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL) return false;
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const u = await r.json();
  const emails = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return emails.includes((u.email || "").toLowerCase());
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!(await permitido(req))) return res.status(401).json({ erro: "Entre com a sua conta pra usar o print." });
  const { imagem } = req.body || {};
  if (!imagem || !imagem.dados) return res.status(400).json({ erro: "Mande uma imagem." });
  if (!IMAGENS.includes(imagem.tipo)) return res.status(400).json({ erro: "Formato de imagem não suportado." });
  try {
    return res.status(200).json(await lerPrint({ imagem }));
  } catch (e) {
    if (e.codigo === "recusa") return res.status(422).json({ erro: e.message });
    if (e.codigo === "limite") return res.status(429).json({ erro: "A cota grátis da IA acabou por agora. Tente daqui a pouco." });
    if (e.codigo === "sem_chave" || e.codigo === "chave_errada") return res.status(500).json({ erro: e.message });
    console.error(e);
    return res.status(500).json({ erro: "Não consegui ler o print. Tente de novo." });
  }
}

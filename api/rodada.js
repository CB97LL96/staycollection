// Rodada assistida: devolve o que a planilha da CEG diz hoje (só as linhas com o
// nome dela). NÃO grava nada e não devolve pix nem caminho de comprovante.
// Variáveis: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID,
// ALLOWED_EMAILS, MEUS_NOMES.
import { baixarPlanilha, linhasDela } from "../scripts/conferir-cobrancas.mjs";
import { resumoPlanilha } from "../scripts/rodada-core.mjs";

async function permitido(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL) return false;
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const u = await r.json();
  const emails = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return emails.includes((u.email || "").toLowerCase());
}

async function rest(path) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`Supabase: HTTP ${r.status}`);
  return r.json();
}

const ABERTAS = ["Pendente", "A confirmar", "Aguardando a GOM", "Não liberado"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!(await permitido(req))) return res.status(401).json({ erro: "Entre com a sua conta pra usar isto." });
  const owner = process.env.OWNER_ID;
  if (!owner || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ erro: "Falta configurar OWNER_ID e SUPABASE_SERVICE_ROLE_KEY na Vercel." });
  const { ceg = "", comunidade = "" } = req.body || {};
  if (!String(ceg).trim()) return res.status(400).json({ erro: "Diga qual CEG." });
  const nomes = (process.env.MEUS_NOMES || "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const docs = await rest(`docs?owner=eq.${owner}&col=in.(cegs,cobrancas)&select=col,id,data&limit=10000`);
    const doc = docs.find((d) => d.col === "cegs" && d.data.nome === ceg && (d.data.comunidade || "") === comunidade);
    if (!doc) return res.status(200).json({ cadastrada: false, temPlanilha: false });
    const link = String(doc.data.planilha || "").trim();
    if (!/^https:\/\//.test(link)) return res.status(200).json({ cadastrada: true, temPlanilha: false });
    if (/paboracha\.com/i.test(link)) return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: false, motivo: "A planilha desta CEG é a do Paboracha: confira pelo app deles." });
    if (!nomes.length) return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: false, motivo: "Falta configurar MEUS_NOMES na Vercel pra achar as suas linhas." });
    const cobs = docs.filter((d) => d.col === "cobrancas" && d.data.ceg === ceg && (d.data.comunidade || "") === comunidade && ABERTAS.includes(d.data.status)).map((d) => ({ id: d.id, valor: d.data.valor }));
    const abas = linhasDela(await baixarPlanilha(link), nomes);
    return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: true, ...resumoPlanilha(abas, cobs) });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: false, motivo: "Não consegui abrir a planilha agora. Abra pelo link." });
  }
}

// Rodada assistida: devolve o que a planilha da CEG diz hoje (só as linhas com o
// nome dela). NÃO grava nada e não devolve pix nem caminho de comprovante.
// Variáveis: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID,
// ALLOWED_EMAILS, MEUS_NOMES.
import { abrirStore } from "../scripts/v2/store.mjs";
import { baixarPlanilha, linhasDela } from "../scripts/conferir-cobrancas.mjs";
import { baixarCobrancasPabo } from "../scripts/conferir-paboracha.mjs";
import { resumoPlanilha, abasPabo, ehForms } from "../scripts/rodada-core.mjs";

async function permitido(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL) return false;
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const u = await r.json();
  const emails = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return emails.includes((u.email || "").toLowerCase());
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
    const docs = await abrirStore({ owner }).lerDocs(["cegs", "cobrancas"]); // docs ou v2, conforme DATA_MODEL
    const doc = docs.find((d) => d.col === "cegs" && d.data.nome === ceg && (d.data.comunidade || "") === comunidade);
    if (!doc) return res.status(200).json({ cadastrada: false, temPlanilha: false });
    const link = String(doc.data.planilha || "").trim();
    if (!/^https:\/\//.test(link)) return res.status(200).json({ cadastrada: true, temPlanilha: false });
    if (ehForms(link)) return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: false, forms: true, motivo: "Esta CEG usa forms: abra pelo link e veja se você já respondeu." });
    const cobs = docs.filter((d) => d.col === "cobrancas" && d.data.ceg === ceg && (d.data.comunidade || "") === comunidade && ABERTAS.includes(d.data.status)).map((d) => ({ id: d.id, valor: d.data.valor }));
    if (/paboracha\.com/i.test(link)) {
      if (!process.env.PABORACHA_PERFIL) return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: false, motivo: "Falta configurar PABORACHA_PERFIL na Vercel pra ler o Paboracha." });
      const abas = abasPabo(await baixarCobrancasPabo(process.env.PABORACHA_PERFIL), ceg);
      return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: true, paboracha: true, ...resumoPlanilha(abas, cobs) });
    }
    if (!nomes.length) return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: false, motivo: "Falta configurar MEUS_NOMES na Vercel pra achar as suas linhas." });
    const abas = linhasDela(await baixarPlanilha(link), nomes);
    return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: true, ...resumoPlanilha(abas, cobs) });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ cadastrada: true, temPlanilha: true, lida: false, motivo: "Não consegui abrir a planilha agora. Abra pelo link." });
  }
}

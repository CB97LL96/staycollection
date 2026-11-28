// Compartilhar do WhatsApp para o app: recebe uma mensagem (texto) ou um print,
// investiga como o bot do Telegram (scripts/investigar.mjs), guarda as sugestões
// na caixa (aba de sugestões do app) e devolve o resultado pra mostrar na hora.
// Variáveis: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
// OWNER_ID, ALLOWED_EMAILS, MEUS_NOMES, DATA_MODEL (docs ou v2).
import { createHash } from "node:crypto";
import { investigar } from "../scripts/investigar.mjs";
import { IMAGENS } from "../scripts/ler-core.mjs";
import { abrirStore } from "../scripts/v2/store.mjs";

async function permitido(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL) return false;
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  const u = await r.json();
  const emails = (process.env.ALLOWED_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return emails.includes((u.email || "").toLowerCase());
}

const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!(await permitido(req))) return res.status(401).json({ erro: "Entre com a sua conta pra usar isto." });
  const owner = process.env.OWNER_ID;
  if (!owner || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ erro: "Falta configurar OWNER_ID e SUPABASE_SERVICE_ROLE_KEY na Vercel." });
  const { texto = "", nomeArquivo = "", imagem = null, cegForcada = null } = req.body || {};
  if (!String(texto).trim() && !imagem) return res.status(400).json({ erro: "Mande um texto ou uma imagem." });
  if (imagem && !IMAGENS.includes(imagem.tipo)) return res.status(400).json({ erro: "Formato de imagem não suportado." });
  const fonte = String(texto).slice(0, 60000);

  try {
    // Mesma mensagem de novo: não lê outra vez (só vale sem escolha manual de CEG).
    const hash = createHash("sha1").update(fonte).update(imagem ? imagem.dados : "").update(String(cegForcada || "")).digest("hex");
    const s = abrirStore({ owner }); // docs ou v2, conforme DATA_MODEL
    const igual = (await s.listar("caixa")).filter((x) => x.data.hash === hash && x.data.estado === "lida").slice(0, 1);
    if (igual.length) return res.status(200).json({ repetido: true, id: igual[0].id, resumo: igual[0].data.resumo || "", ceg: igual[0].data.ceg || null, totalDevido: igual[0].data.totalDevido ?? null, semValor: igual[0].data.semValor || 0, pergunta: "", registros: igual[0].data.registros || [] });

    const docs = await s.lerDocs(["comunidades", "cegs", "gruposwa", "cobrancas", "itens", "envios", "repasses"]);
    const nomes = (process.env.MEUS_NOMES || "").split(",").map((s) => s.trim()).filter(Boolean);
    const r = await investigar({ texto: fonte, nomeArquivo, imagens: imagem ? [imagem] : [] }, docs, { nomes, hoje: hojeBR(), cegForcada });
    const registros = r.registros.map((x) => ({ ...x, estado: "pendente" }));
    const id = "app-" + Date.now().toString(36);
    await s.gravar("caixa", id, { origem: "whatsapp", recebidoEm: new Date().toISOString(), texto: fonte.slice(0, 2000), estado: "lida", hash, resumo: r.resumo, registros, ceg: r.ceg, totalDevido: r.totalDevido, semValor: r.semValor, candidatas: r.candidatas, pergunta: r.pergunta, fonte: imagem ? "" : fonte, arquivo: nomeArquivo });
    return res.status(200).json({ id, ...r, registros });
  } catch (e) {
    if (e.codigo === "recusa") return res.status(422).json({ erro: e.message });
    if (e.codigo === "limite") return res.status(429).json({ erro: "A cota grátis da IA acabou por agora. Tente daqui a pouco." });
    if (e.codigo === "sem_chave" || e.codigo === "chave_errada") return res.status(500).json({ erro: e.message });
    console.error(e);
    return res.status(500).json({ erro: "Não consegui ler isso. Tente de novo." });
  }
}

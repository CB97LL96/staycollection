// Caixa de entrada pelo Telegram: tudo que a Lari manda pro bot (texto, print,
// conversa exportada do WhatsApp em .txt) é guardado no Supabase e lido pela
// IA (Gemini, scripts/ia.mjs) na hora. O resultado vira SUGESTÃO na aba "O que devo" do app: nada
// vira cobrança sem ela aceitar lá.
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   TELEGRAM_BOT_TOKEN  token que o @BotFather dá ao criar o bot
//   TELEGRAM_SECRET     um texto secreto qualquer (o Telegram manda ele em cada
//                       mensagem, e assim ninguém mais consegue usar este endereço)
//   TELEGRAM_CHAT_ID    o código do seu chat com o bot. Se faltar, o bot responde
//                       dizendo qual é, pra você colar aqui.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID, GEMINI_API_KEY, MEUS_NOMES
import { lerFonte, IMAGENS } from "../scripts/ler-core.mjs";

const TG = (m) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;
const LIMITE_TEXTO = 60000;

async function responder(chatId, texto) {
  await fetch(TG("sendMessage"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto, disable_web_page_preview: true }),
  }).catch(() => {});
}

async function baixarArquivo(fileId) {
  const r = await fetch(TG(`getFile?file_id=${encodeURIComponent(fileId)}`));
  const j = await r.json();
  if (!j.ok) throw new Error("não consegui baixar o arquivo do Telegram");
  const f = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${j.result.file_path}`);
  if (!f.ok) throw new Error(`arquivo do Telegram: HTTP ${f.status}`);
  return Buffer.from(await f.arrayBuffer());
}

// Conversa exportada grande: fica só com as linhas que podem ser cobrança
// (citam o nome dela ou falam de dinheiro, prazo, frete...), com a linha
// anterior de contexto. Mesma ideia do scripts/filtrar-whatsapp.mjs.
const CHAVES = /cobran[çc]a|frete|taxa|\bpix\b|pagamento|pagar|prazo|multa|armazen|comprovante|liberad|fechou|vencimento|r\$\s*\d|\d+[.,]\d{2}|\bdevendo\b|atras/i;
function encolher(texto, nomes) {
  if (texto.length <= LIMITE_TEXTO) return texto;
  const linhas = texto.replace(/\r/g, "").split("\n");
  const nm = nomes.map((n) => n.toLowerCase());
  const manter = new Set();
  linhas.forEach((l, i) => { if (CHAVES.test(l) || nm.some((n) => l.toLowerCase().includes(n))) { manter.add(i - 1); manter.add(i); } });
  const out = linhas.filter((_, i) => manter.has(i)).join("\n");
  return out.length > LIMITE_TEXTO ? out.slice(-LIMITE_TEXTO) : out;
}

async function rest(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase: HTTP ${r.status} ${await r.text()}`);
  // Com return=minimal, atualizar um registro que já existe volta 200 sem corpo.
  const t = await r.text();
  return t.trim() ? JSON.parse(t) : null;
}

const owner = () => process.env.OWNER_ID;
const salvar = (id, data) => rest(`docs?on_conflict=owner,col,id`, {
  method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({ owner: owner(), col: "caixa", id, data }),
});

async function contexto() {
  const docs = await rest(`docs?owner=eq.${owner()}&col=in.(comunidades,cegs)&select=col,data&limit=2000`);
  const nomes = (col) => [...new Set(docs.filter((d) => d.col === col).map((d) => d.data && d.data.nome).filter(Boolean))];
  return { hoje: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10), comunidades: nomes("comunidades"), cegs: nomes("cegs") };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.TELEGRAM_SECRET || req.headers["x-telegram-bot-api-secret-token"] !== process.env.TELEGRAM_SECRET) return res.status(401).end();
  const up = req.body || {};
  const msg = up.message;
  if (!msg) return res.status(200).end();
  const chatId = String(msg.chat.id);

  if (chatId !== String(process.env.TELEGRAM_CHAT_ID || "")) {
    await responder(chatId, `Este bot é privado. Se você é a dona, coloque TELEGRAM_CHAT_ID = ${chatId} na Vercel e faça um redeploy.`);
    return res.status(200).end();
  }
  if (msg.text && /^\/start\b/.test(msg.text)) {
    await responder(chatId, "Oi! Me mande mensagens, prints ou conversas exportadas do WhatsApp (.txt) com cobranças. Eu leio e deixo sugestões na aba \"O que devo\" do app, pra você aceitar.");
    return res.status(200).end();
  }

  // Um registro por mensagem. Se o Telegram reenviar a mesma, não lê de novo.
  const id = `tg-${up.update_id}`;
  const ja = await rest(`docs?owner=eq.${owner()}&col=eq.caixa&id=eq.${id}&select=id`);
  if (ja.length) return res.status(200).end();

  const nomes = (process.env.MEUS_NOMES || "").split(",").map((s) => s.trim()).filter(Boolean);
  const base = { origem: "telegram", recebidoEm: new Date((msg.date || Date.now() / 1000) * 1000).toISOString(), texto: (msg.text || msg.caption || "").slice(0, 2000), estado: "lendo" };
  await salvar(id, base);

  try {
    let fonte = msg.text || msg.caption || "";
    const imagens = [];
    if (msg.photo && msg.photo.length) {
      const maior = msg.photo[msg.photo.length - 1];
      imagens.push({ tipo: "image/jpeg", dados: (await baixarArquivo(maior.file_id)).toString("base64") });
    } else if (msg.document) {
      const tipo = msg.document.mime_type || "";
      if (IMAGENS.includes(tipo)) imagens.push({ tipo, dados: (await baixarArquivo(msg.document.file_id)).toString("base64") });
      else if (tipo.startsWith("text/") || /\.txt$/i.test(msg.document.file_name || "")) {
        const t = (await baixarArquivo(msg.document.file_id)).toString("utf8");
        fonte = [fonte, `Conversa exportada: ${msg.document.file_name || ""}`, encolher(t, nomes)].filter(Boolean).join("\n\n");
      } else throw new Error("Esse tipo de arquivo eu não leio. Mande texto, foto ou o .txt da conversa exportada.");
    }
    if (!fonte.trim() && !imagens.length) throw new Error("Não achei texto nem imagem nessa mensagem.");

    const r = await lerFonte({ fonte, imagens, contexto: await contexto() });
    const registros = (r.registros || []).map((x) => ({ ...x, estado: "pendente" }));
    await salvar(id, { ...base, estado: "lida", resumo: r.resumo, registros });
    const cob = registros.filter((x) => x.destino === "cobrancas");
    const total = cob.reduce((s, x) => s + (typeof x.valor === "number" ? x.valor : 0), 0);
    await responder(chatId, registros.length
      ? `Li! ${registros.length} sugest${registros.length === 1 ? "ão" : "ões"}${cob.length ? ` (${cob.length} cobrança${cob.length === 1 ? "" : "s"}, R$ ${total.toFixed(2).replace(".", ",")})` : ""}. Confira e aceite na aba "O que devo" do app.`
      : `Li, mas não achei nada seu: ${r.resumo}`);
  } catch (e) {
    console.error(e);
    await salvar(id, { ...base, estado: "erro", erro: e.message }).catch(() => {});
    await responder(chatId, `Não consegui ler: ${e.message} Ficou guardado na caixa de entrada do app.`);
  }
  return res.status(200).end();
}

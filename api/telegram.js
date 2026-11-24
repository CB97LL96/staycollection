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
import { IMAGENS } from "../scripts/ler-core.mjs";
import { investigar, respostaTelegram } from "../scripts/investigar.mjs";
import { aceitarTodas, descartarTodas } from "../scripts/aceitar.mjs";

const TG = (m) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;
const LIMITE_TEXTO = 60000;

const APP = process.env.APP_URL || "https://staycollection.vercel.app/";
async function tg(metodo, corpo) {
  await fetch(TG(metodo), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => {});
}
async function responder(chatId, texto, botoes) {
  await tg("sendMessage", { chat_id: chatId, text: texto, disable_web_page_preview: true, ...(botoes ? { reply_markup: { inline_keyboard: botoes } } : {}) });
}
// Botões da resposta. callback_data tem no máximo 64 bytes.
function botoesDe(id, r) {
  if (!r.ceg && r.candidatas.length > 1) return r.candidatas.slice(0, 3).map((c, i) => [{ text: c.nome.slice(0, 40), callback_data: `ceg:${id}:${i}` }]).concat([[{ text: "Não é minha", callback_data: `no:${id}` }]]);
  const pend = r.registros.length;
  return [
    ...(pend ? [[{ text: pend === 1 ? "Aceitar" : `Aceitar as ${pend}`, callback_data: `ok:${id}` }, { text: "Não é minha", callback_data: `no:${id}` }]] : []),
    [{ text: "Ver no app", url: APP }],
  ];
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

import { createHash } from "node:crypto";
import { marcarFonte } from "../scripts/fontes.mjs";
const owner = () => process.env.OWNER_ID;
const salvar = (id, data) => rest(`docs?on_conflict=owner,col,id`, {
  method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({ owner: owner(), col: "caixa", id, data }),
});

// Anti-duplicata: a Lari pode mandar o mesmo arquivo/print mais de uma vez.
// 1) mesmo conteúdo (hash do texto + imagens) já lido => nem chama a IA;
// 2) sugestão com o mesmo trecho, destino e valor de uma já existente (inclusive
//    aceita ou descartada) => não entra de novo.
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 120);
// Trecho vazio ou curto demais não serve de chave (acusaria duplicata à toa).
const chaveRegistro = (r) => { const t = norm(r.trecho); return t.length < 15 ? null : `${r.destino}|${r.valor ?? ""}|${t}`; };

const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
// O que o bot precisa pra investigar: comunidades, CEGs, grupos, cobranças, itens.
const docsDoApp = () => rest(`docs?owner=eq.${owner()}&col=in.(comunidades,cegs,gruposwa,cobrancas,itens,envios,repasses)&select=col,id,data&limit=10000`);

// Lê de novo uma mensagem já guardada, agora com a CEG que ela escolheu.
async function reinvestigar(chatId, caixaId, idx) {
  const [cx] = await rest(`docs?owner=eq.${owner()}&col=eq.caixa&id=eq.${encodeURIComponent(caixaId)}&select=data`);
  if (!cx) return responder(chatId, "Não achei mais essa mensagem.");
  const c = cx.data, escolhida = (c.candidatas || [])[idx];
  if (!escolhida) return responder(chatId, "Essa opção não existe mais.");
  const nomes = (process.env.MEUS_NOMES || "").split(",").map((x) => x.trim()).filter(Boolean);
  const r = await investigar({ texto: c.fonte || c.texto || "", nomeArquivo: c.arquivo || "" }, await docsDoApp(), { nomes, hoje: hojeBR(), cegForcada: escolhida.id });
  const registros = r.registros.map((x) => ({ ...x, estado: "pendente" }));
  await salvar(caixaId, { ...c, resumo: r.resumo, registros, ceg: r.ceg, totalDevido: r.totalDevido, semValor: r.semValor, pergunta: r.pergunta });
  await responder(chatId, respostaTelegram({ ...r, registros }), botoesDe(caixaId, { ...r, registros }));
}

async function botao(q) {
  const chatId = String(q.message && q.message.chat && q.message.chat.id);
  if (chatId !== String(process.env.TELEGRAM_CHAT_ID || "")) return;
  const [tipo, caixaId, extra] = String(q.data || "").split(":");
  await tg("answerCallbackQuery", { callback_query_id: q.id, text: tipo === "ok" ? "Gravando…" : tipo === "ceg" ? "Lendo de novo…" : "Ok" });
  // tira os botões da mensagem, pra não tocar duas vezes
  await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [[{ text: "Ver no app", url: APP }]] } });
  const restOwner = (path, opts) => rest(path, opts);
  if (tipo === "ok") {
    const { ok, falhas, sumiu } = await aceitarTodas(restOwner, owner(), caixaId);
    await responder(chatId, sumiu ? "Não achei mais essa sugestão." : `Gravado no app: ${ok}${falhas ? `. ${falhas} não deram (o registro mudou ou sumiu); confira na aba de sugestões.` : "."}`);
  } else if (tipo === "no") {
    await descartarTodas(restOwner, owner(), caixaId);
    await responder(chatId, "Descartado. Nada mudou no app.");
  } else if (tipo === "ceg") {
    try { await reinvestigar(chatId, caixaId, Number(extra)); } catch (e) { await responder(chatId, `Não consegui ler de novo: ${e.message}`); }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.TELEGRAM_SECRET || req.headers["x-telegram-bot-api-secret-token"] !== process.env.TELEGRAM_SECRET) return res.status(401).end();
  const up = req.body || {};
  if (up.callback_query) { await botao(up.callback_query).catch((e) => console.error(e)); return res.status(200).end(); }
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
    let ultimaMsg = null; // data da última mensagem do .txt do WhatsApp
    const imagens = [];
    if (msg.photo && msg.photo.length) {
      const maior = msg.photo[msg.photo.length - 1];
      imagens.push({ tipo: "image/jpeg", dados: (await baixarArquivo(maior.file_id)).toString("base64") });
    } else if (msg.document) {
      const tipo = msg.document.mime_type || "";
      if (IMAGENS.includes(tipo)) imagens.push({ tipo, dados: (await baixarArquivo(msg.document.file_id)).toString("base64") });
      else if (tipo.startsWith("text/") || /\.txt$/i.test(msg.document.file_name || "")) {
        const t = (await baixarArquivo(msg.document.file_id)).toString("utf8");
        const datas = [...t.matchAll(/^(\d{2})\/(\d{2})\/(\d{4}) \d{2}:\d{2} - /gm)];
        if (datas.length) { const d = datas[datas.length - 1]; ultimaMsg = `${d[3]}-${d[2]}-${d[1]}`; }
        fonte = [fonte, `Conversa exportada: ${msg.document.file_name || ""}`, encolher(t, nomes)].filter(Boolean).join("\n\n");
      } else throw new Error("Esse tipo de arquivo eu não leio. Mande texto, foto ou o .txt da conversa exportada.");
    }
    if (!fonte.trim() && !imagens.length) throw new Error("Não achei texto nem imagem nessa mensagem.");

    const hash = createHash("sha1").update(fonte).update(imagens.map((i) => i.dados).join("")).digest("hex");
    const igual = await rest(`docs?owner=eq.${owner()}&col=eq.caixa&data->>hash=eq.${hash}&data->>estado=eq.lida&id=neq.${id}&select=id&limit=1`);
    if (igual.length) {
      await rest(`docs?owner=eq.${owner()}&col=eq.caixa&id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
      await responder(chatId, "Já li exatamente isso antes. Não criei sugestão nova, então nada duplicou na aba \"O que devo\".");
      return res.status(200).end();
    }

    const r = await investigar({ texto: fonte, nomeArquivo: (msg.document && msg.document.file_name) || "", imagens }, await docsDoApp(), { nomes, hoje: hojeBR() });
    const antigas = await rest(`docs?owner=eq.${owner()}&col=eq.caixa&id=neq.${id}&select=data&limit=2000`);
    const jaTem = new Set(antigas.flatMap((d) => ((d.data && d.data.registros) || []).map(chaveRegistro)).filter(Boolean));
    const todos = (r.registros || []).map((x) => ({ ...x, estado: "pendente" }));
    const registros = todos.filter((x) => { const k = chaveRegistro(x); if (!k) return true; if (jaTem.has(k)) return false; jaTem.add(k); return true; });
    const repetidos = todos.length - registros.length;
    await salvar(id, { ...base, hash, estado: "lida", resumo: r.resumo, registros, ceg: r.ceg, totalDevido: r.totalDevido, semValor: r.semValor, candidatas: r.candidatas, pergunta: r.pergunta,
      // guardado pra ler de novo se ela escolher outra CEG (só texto; imagem não é guardada)
      fonte: imagens.length ? "" : fonte.slice(0, 60000), arquivo: (msg.document && msg.document.file_name) || "", ...(repetidos ? { repetidos } : {}) });
    await marcarFonte(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, owner(), "bot", { nota: `${registros.length} sugestão(ões)` });
    if (ultimaMsg) await marcarFonte(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, owner(), "whatsapp", { nota: "conversa enviada ao bot", ate: ultimaMsg });
    if (repetidos && !registros.length) {
      await rest(`docs?owner=eq.${owner()}&col=eq.caixa&id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
      await responder(chatId, `Li, mas as ${repetidos} sugestões já estavam na aba de sugestões (ou já foram aceitas ou descartadas). Não criei nada repetido.`);
      return res.status(200).end();
    }
    const resp = { ...r, registros };
    await responder(chatId, respostaTelegram(resp) + (repetidos ? `\n(${repetidos} já tinham sido sugeridas antes e ficaram de fora)` : ""), botoesDe(id, resp));
  } catch (e) {
    console.error(e);
    await salvar(id, { ...base, estado: "erro", erro: e.message }).catch(() => {});
    await responder(chatId, `Não consegui ler: ${e.message} Ficou guardado na caixa de entrada do app.`);
  }
  return res.status(200).end();
}

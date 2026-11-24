// node --test --experimental-test-module-mocks scripts/telegram.fluxo.test.mjs
// O webhook do Telegram de ponta a ponta: mensagem -> sugestão guardada ->
// resposta com botões -> toque em "Aceitar" -> gravado no app. Supabase,
// Telegram e IA simulados.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

mock.module("./ia.mjs", { namedExports: { gerarJson: async () => ({ modelo: "falso", json: { resumo: "frete", ceg: "Caixa 2 PHP", pergunta: "", mudancas: [
  { acao: "nova", alvo: "", destino: "cobrancas", referente: "frete inter", tipo: "Frete internacional", membro: "", valor: 18.4, prazo: "", status: "Pendente", base: "mensagem", trecho: "frete inter 18,40 cada", confianca: "alta", duvidas: "" },
] } }) } });

Object.assign(process.env, { TELEGRAM_SECRET: "s", TELEGRAM_CHAT_ID: "42", TELEGRAM_BOT_TOKEN: "t", SUPABASE_URL: "https://sb", SUPABASE_SERVICE_ROLE_KEY: "k", OWNER_ID: "dono", MEUS_NOMES: "Lari" });
const banco = new Map([
  ["comunidades/c1", { nome: "Comunidade Azul", goms: "Gabi" }],
  ["cegs/g1", { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi" }],
]);
const enviados = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url), ok = (corpo) => ({ ok: true, status: 200, text: async () => (corpo == null ? "" : JSON.stringify(corpo)), json: async () => corpo });
  if (u.host === "api.telegram.org") { enviados.push({ metodo: u.pathname.split("/").pop(), corpo: JSON.parse(opts.body || "{}") }); return ok({ ok: true }); }
  const p = u.searchParams, col = (p.get("col") || "").replace(/^eq\./, ""), id = (p.get("id") || "").replace(/^eq\./, "");
  if (!opts.method || opts.method === "GET") {
    if (p.get("col")?.startsWith("in.")) { const cols = p.get("col").slice(4, -1).split(","); return ok([...banco].filter(([k]) => cols.includes(k.split("/")[0])).map(([k, data]) => ({ col: k.split("/")[0], id: k.split("/")[1], data }))); }
    if (p.get("data->>hash")) return ok([]);
    if (id && !id.startsWith("neq.")) return ok(banco.has(`${col}/${id}`) ? [{ id, data: banco.get(`${col}/${id}`) }] : []);
    return ok([...banco].filter(([k]) => k.startsWith(col + "/")).map(([k, data]) => ({ id: k.split("/")[1], data })));
  }
  const corpo = JSON.parse(opts.body || "null");
  if (opts.method === "POST") (Array.isArray(corpo) ? corpo : [corpo]).forEach((r) => banco.set(`${r.col}/${r.id}`, r.data));
  if (opts.method === "PATCH") banco.set(`${col}/${id}`, corpo.data);
  if (opts.method === "DELETE") banco.delete(`${col}/${id}`);
  return ok(null);
};

const { default: handler } = await import("../api/telegram.js");
const chamar = (body) => new Promise((resolve) => {
  const res = { status: () => ({ end: resolve }) };
  handler({ method: "POST", headers: { "x-telegram-bot-api-secret-token": "s" }, body }, res);
});

test("mensagem vira sugestão com total e botões; Aceitar grava a cobrança", async () => {
  await chamar({ update_id: 7, message: { chat: { id: 42 }, date: 1764000000, text: "Caixa 2 PHP: frete inter 18,40 cada" } });
  const cx = banco.get("caixa/tg-7");
  assert.equal(cx.estado, "lida");
  assert.equal(cx.ceg.nome, "Caixa 2 PHP");
  assert.equal(cx.totalDevido, 18.4);
  const msg = enviados.find((e) => e.metodo === "sendMessage").corpo;
  assert.match(msg.text, /Você deve nesta CEG: R\$ 18,40/);
  assert.equal(msg.reply_markup.inline_keyboard[0][0].callback_data, "ok:tg-7");

  await chamar({ update_id: 8, callback_query: { id: "q", data: "ok:tg-7", message: { message_id: 1, chat: { id: 42 } } } });
  const nova = [...banco].find(([k]) => k.startsWith("cobrancas/"));
  assert.ok(nova, "cobrança gravada");
  assert.equal(nova[1].referente, "frete inter");
  assert.equal(nova[1].status, "Pendente");
  assert.equal(banco.get("caixa/tg-7").registros[0].estado, "aceito");
  assert.match(enviados.at(-1).corpo.text, /Gravado no app: 1/);
});

test("botão de outro chat é ignorado", async () => {
  const antes = enviados.length;
  await chamar({ update_id: 9, callback_query: { id: "q2", data: "no:tg-7", message: { message_id: 1, chat: { id: 99 } } } });
  assert.equal(enviados.length, antes);
});

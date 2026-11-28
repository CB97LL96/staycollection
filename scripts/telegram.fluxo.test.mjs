// node --test --experimental-test-module-mocks scripts/telegram.fluxo.test.mjs
// O webhook do Telegram de ponta a ponta: mensagem -> sugestão guardada ->
// resposta com botões -> toque em "Aceitar" -> gravado no app. Supabase,
// Telegram e IA simulados.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { criarBanco } from "./v2/banco-falso-servidor.mjs";

mock.module("./ia.mjs", { namedExports: { gerarJson: async () => ({ modelo: "falso", json: { resumo: "frete", ceg: "Caixa 2 PHP", pergunta: "", mudancas: [
  { acao: "nova", alvo: "", destino: "cobrancas", referente: "frete inter", tipo: "Frete internacional", membro: "", valor: 18.4, prazo: "", status: "Pendente", base: "mensagem", trecho: "frete inter 18,40 cada", confianca: "alta", duvidas: "" },
] } }) } });

Object.assign(process.env, { TELEGRAM_SECRET: "s", TELEGRAM_CHAT_ID: "42", TELEGRAM_BOT_TOKEN: "t", SUPABASE_URL: "https://sb", SUPABASE_SERVICE_ROLE_KEY: "k", OWNER_ID: "dono", MEUS_NOMES: "Lari" });
const sementes = () => [
  { col: "comunidades", id: "c1", data: { nome: "Comunidade Azul", goms: "Gabi" } },
  { col: "cegs", id: "g1", data: { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi" } },
];
const enviados = [];
const telegram = (url, opts = {}) => {
  const u = new URL(url);
  enviados.push({ metodo: u.pathname.split("/").pop(), corpo: JSON.parse(opts.body || "{}") });
  return { ok: true, status: 200, text: async () => "{}", json: async () => ({ ok: true }) };
};

const { default: handler } = await import("../api/telegram.js");
const chamar = (body) => new Promise((resolve) => {
  const res = { status: () => ({ end: resolve }) };
  handler({ method: "POST", headers: { "x-telegram-bot-api-secret-token": "s" }, body }, res);
});

// o webhook inteiro, nos dois modelos de dados (DATA_MODEL)
for (const modelo of ["docs", "v2"]) {
  const banco = criarBanco(modelo, sementes());
  const usar = () => { process.env.DATA_MODEL = modelo; banco.instalar(telegram); enviados.length = 0; };

  test(`[${modelo}] mensagem vira sugestão com total e botões; Aceitar grava a cobrança`, async () => {
    usar();
    await chamar({ update_id: 7, message: { chat: { id: 42 }, date: 1764000000, text: "Caixa 2 PHP: frete inter 18,40 cada" } });
    const cx = banco.docs.get("caixa/tg-7");
    assert.equal(cx.estado, "lida");
    assert.equal(cx.ceg.nome, "Caixa 2 PHP");
    assert.equal(cx.totalDevido, 18.4);
    const msg = enviados.find((e) => e.metodo === "sendMessage").corpo;
    assert.match(msg.text, /Você deve nesta CEG: R\$ 18,40/);
    // o id do botão do Telegram é o mesmo nos dois modelos (cabe nos 64 bytes)
    assert.equal(msg.reply_markup.inline_keyboard[0][0].callback_data, "ok:tg-7");

    await chamar({ update_id: 8, callback_query: { id: "q", data: "ok:tg-7", message: { message_id: 1, chat: { id: 42 } } } });
    const nova = [...banco.docs].find(([k]) => k.startsWith("cobrancas/"));
    assert.ok(nova, "cobrança gravada");
    assert.equal(nova[1].referente, "frete inter");
    assert.equal(nova[1].status, "Pendente");
    assert.equal(nova[1].ceg, "Caixa 2 PHP");
    assert.equal(banco.docs.get("caixa/tg-7").registros[0].estado, "aceito");
    assert.match(enviados.at(-1).corpo.text, /Gravado no app: 1/);
    if (modelo === "v2") assert.ok([...banco.T.cobrancas.values()].some((c) => c.ceg_id === "ceg-g1")); // ligada à CEG por id
  });

  test(`[${modelo}] a mesma mensagem de novo não lê outra vez`, async () => {
    usar();
    await chamar({ update_id: 7, message: { chat: { id: 42 }, date: 1764000000, text: "Caixa 2 PHP: frete inter 18,40 cada" } });
    assert.equal(enviados.length, 0);
  });

  test(`[${modelo}] botão de outro chat é ignorado`, async () => {
    usar();
    await chamar({ update_id: 9, callback_query: { id: "q2", data: "no:tg-7", message: { message_id: 1, chat: { id: 99 } } } });
    assert.equal(enviados.length, 0);
  });
}

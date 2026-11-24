// node --test --experimental-test-module-mocks scripts/conferir-cobrancas.test.mjs
// Cron diário: confere as cobranças abertas e sugere as que estão na planilha
// e faltam no app. Supabase, planilha e IA simulados.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const pedidos = [];
mock.module("./ia.mjs", { namedExports: { gerarJson: async ({ texto }) => {
  pedidos.push(texto);
  return { json: {
    resultados: [{ id: "k1", resultado: "igual", nota: "" }],
    faltando: texto.includes("CEG: Caixa 2") ? [{ referente: "frete inter", tipo: "Frete internacional", valor: 18.4, prazo: "", trecho: "Lari,frete,18.40" }] : [],
  } };
} } });
process.env.GEMINI_API_KEY = "x";

const banco = [
  { col: "cegs", id: "g1", data: { nome: "Caixa 2", comunidade: "Azul", planilha: "https://docs.google.com/spreadsheets/d/aaa/edit" } },
  { col: "cegs", id: "g2", data: { nome: "Sem cobrança aberta", comunidade: "Azul", planilha: "https://docs.google.com/spreadsheets/d/bbb/edit" } },
  { col: "cegs", id: "g3", data: { nome: "Acabou", comunidade: "Azul", status: "Concluída", planilha: "https://docs.google.com/spreadsheets/d/ccc/edit" } },
  { col: "cobrancas", id: "k1", data: { referente: "taxa", ceg: "Caixa 2", valor: 5, status: "Pendente" } },
  { col: "cobrancas", id: "k0", data: { referente: "item", ceg: "Caixa 2", valor: 60, status: "Paga" } },
];
const gravados = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url), ok = (b, tipo) => ({ ok: true, status: 200, text: async () => (typeof b === "string" ? b : JSON.stringify(b)), json: async () => b });
  if (u.host === "docs.google.com") return u.pathname.endsWith("htmlview") ? ok("<html></html>") : ok(u.pathname.includes("/bbb/") ? "nome,item,valor\nOutra,frete,20" : "nome,item,valor\nLari,frete,18.40\nLari,taxa,5");
  if (!opts.method) {
    const id = (u.searchParams.get("id") || "").replace("eq.", "");
    return ok(id ? banco.filter((d) => d.col === "cobrancas" && d.id === id) : banco);
  }
  gravados.push({ metodo: opts.method, path: u.pathname + u.search, corpo: JSON.parse(opts.body) });
  return ok("");
};

const { conferirCobrancas } = await import("./conferir-cobrancas.mjs");

test("confere, ignora CEG concluída e sugere a cobrança que falta", async () => {
  const r = await conferirCobrancas("https://sb", "k", "dono", { nomes: ["Lari"], hoje: "2026-11-24" });
  assert.equal(r.conferidas, 1);
  assert.equal(r.faltando, 1);
  assert.equal(pedidos.length, 1); // "Sem cobrança aberta" não tem o nome dela: não gasta IA; "Acabou" nem é lida
  assert.match(pedidos[0], /id k0: item/); // a paga vai pra IA, pra não virar "faltante"
  assert.doesNotMatch(pedidos[0], /ABERTA id k0/);
  const caixa = gravados.find((g) => g.metodo === "POST").corpo[0];
  assert.equal(caixa.col, "caixa");
  assert.match(caixa.id, /^pl-/);
  assert.equal(caixa.data.origem, "planilha");
  assert.equal(caixa.data.registros[0].valor, 18.4);
  assert.equal(caixa.data.registros[0].ceg, "Caixa 2");
  const patch = gravados.find((g) => g.metodo === "PATCH");
  assert.equal(patch.corpo.data.conferidoEm, "2026-11-24");
});

test("a mesma linha não é sugerida de novo", async () => {
  const id = gravados.find((g) => g.metodo === "POST").corpo[0].id;
  banco.push({ col: "caixa", id, data: { estado: "lida" } });
  gravados.length = 0;
  const r = await conferirCobrancas("https://sb", "k", "dono", { nomes: ["Lari"], hoje: "2026-11-24" });
  assert.equal(r.faltando, 0);
  assert.equal(gravados.filter((g) => g.metodo === "POST").length, 0);
});

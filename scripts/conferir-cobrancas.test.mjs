// node --test --experimental-test-module-mocks scripts/conferir-cobrancas.test.mjs
// Cron diário: confere as cobranças abertas e sugere as que estão na planilha
// e faltam no app. Supabase, planilha e IA simulados.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { criarBanco } from "./v2/banco-falso-servidor.mjs";

const pedidos = [];
mock.module("./ia.mjs", { namedExports: { gerarJson: async ({ texto }) => {
  pedidos.push(texto);
  return { json: {
    resultados: [{ id: "k1", resultado: "igual", nota: "" }],
    faltando: texto.includes("CEG: Caixa 2") ? [{ referente: "frete inter", tipo: "Frete internacional", valor: 18.4, prazo: "", trecho: "Lari,frete,18.40" }] : [],
  } };
} } });
process.env.GEMINI_API_KEY = "x";

const sementes = () => [
  { col: "cegs", id: "g1", data: { nome: "Caixa 2", comunidade: "Azul", planilha: "https://docs.google.com/spreadsheets/d/aaa/edit" } },
  { col: "cegs", id: "g2", data: { nome: "Sem cobrança aberta", comunidade: "Azul", planilha: "https://docs.google.com/spreadsheets/d/bbb/edit" } },
  { col: "cegs", id: "g3", data: { nome: "Acabou", comunidade: "Azul", status: "Concluída", planilha: "https://docs.google.com/spreadsheets/d/ccc/edit" } },
  { col: "cobrancas", id: "k1", data: { referente: "taxa", ceg: "Caixa 2", valor: 5, status: "Pendente" } },
  { col: "cobrancas", id: "k0", data: { referente: "item", ceg: "Caixa 2", valor: 60, status: "Paga" } },
];
const planilhas = (url) => {
  const u = new URL(url), ok = (b) => ({ ok: true, status: 200, text: async () => b, json: async () => b });
  return u.pathname.endsWith("htmlview") ? ok("<html></html>") : ok(u.pathname.includes("/bbb/") ? "nome,item,valor\nOutra,frete,20" : "nome,item,valor\nLari,frete,18.40\nLari,taxa,5");
};

const { conferirCobrancas } = await import("./conferir-cobrancas.mjs");

// a mesma conferência, nos dois modelos de dados (DATA_MODEL)
for (const modelo of ["docs", "v2"]) {
  const banco = criarBanco(modelo, sementes());
  const usar = (b = banco) => { process.env.DATA_MODEL = modelo; b.instalar(planilhas); }; // fetch e DATA_MODEL valem pro teste que está rodando
  let idSug = "";

  test(`[${modelo}] confere, ignora CEG concluída e sugere a cobrança que falta`, async () => {
    usar(); pedidos.length = 0;
    const r = await conferirCobrancas("https://sb", "k", "dono", { nomes: ["Lari"], hoje: "2026-11-24" });
    assert.equal(r.conferidas, 1);
    assert.equal(r.faltando, 1);
    assert.equal(pedidos.length, 1); // "Sem cobrança aberta" não tem o nome dela: não gasta IA; "Acabou" nem é lida
    assert.match(pedidos[0], /id k0: item/); // a paga vai pra IA, pra não virar "faltante"
    assert.doesNotMatch(pedidos[0], /ABERTA id k0/);
    const sug = [...banco.docs].filter(([k]) => k.startsWith("caixa/"));
    assert.equal(sug.length, 1);
    idSug = sug[0][0].slice(6);
    assert.match(idSug, /^pl-/);
    assert.equal(sug[0][1].origem, "planilha");
    assert.equal(sug[0][1].registros[0].valor, 18.4);
    assert.equal(sug[0][1].registros[0].ceg, "Caixa 2");
    assert.equal(banco.docs.get("cobrancas/k1").conferidoEm, "2026-11-24");
  });

  test(`[${modelo}] a mesma linha não é sugerida de novo`, async () => {
    usar(); const antes = banco.docs.get(`caixa/${idSug}`);
    const r = await conferirCobrancas("https://sb", "k", "dono", { nomes: ["Lari"], hoje: "2026-11-24" });
    assert.equal(r.faltando, 0);
    assert.deepEqual(banco.docs.get(`caixa/${idSug}`), antes);
  });

  test(`[${modelo}] campo que ela travou não é mexido pelo robô`, async () => {
    const b2 = criarBanco(modelo, sementes().map((d) => (d.id === "k1" ? { ...d, data: { ...d.data, travado: ["conferidoEm"] } } : d)));
    usar(b2);
    await conferirCobrancas("https://sb", "k", "dono", { nomes: ["Lari"], hoje: "2026-11-25" });
    assert.equal(b2.docs.get("cobrancas/k1").conferidoEm, undefined);
  });
}

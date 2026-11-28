// node --test --experimental-test-module-mocks scripts/api.fluxo.test.mjs
// api/investigar.js (compartilhar do WhatsApp) e api/rodada.js (rodada assistida)
// de ponta a ponta, nos dois modelos de dados (DATA_MODEL). IA, planilha e login simulados.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { criarBanco } from "./v2/banco-falso-servidor.mjs";

mock.module("./ia.mjs", { namedExports: { gerarJson: async () => ({ modelo: "falso", json: { resumo: "frete", ceg: "Caixa 2 PHP", pergunta: "", mudancas: [
  { acao: "nova", alvo: "", destino: "cobrancas", referente: "frete inter", tipo: "Frete internacional", membro: "", valor: 18.4, prazo: "", status: "Pendente", base: "mensagem", trecho: "Caixa 2 PHP: frete inter 18,40 cada", confianca: "alta" },
] } }) } });
Object.assign(process.env, { SUPABASE_URL: "https://sb", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "k", OWNER_ID: "dono", ALLOWED_EMAILS: "ela@exemplo.com", MEUS_NOMES: "Lari" });

const sementes = () => [
  { col: "comunidades", id: "c1", data: { nome: "Comunidade Azul", goms: "Gabi" } },
  { col: "cegs", id: "g1", data: { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi" } },
  { col: "cegs", id: "g2", data: { nome: "Com forms", comunidade: "Comunidade Azul", planilha: "https://docs.google.com/forms/d/e/abc/viewform" } },
  { col: "cobrancas", id: "k1", data: { referente: "taxa", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", valor: 5, status: "Pendente" } },
];
const login = (url) => ({ ok: true, status: 200, text: async () => "{}", json: async () => ({ email: "ela@exemplo.com" }) });
const chamar = (handler, body) => new Promise((resolve) => {
  const res = { status: (c) => ({ json: (j) => resolve({ status: c, corpo: j }), end: () => resolve({ status: c }) }) };
  handler({ method: "POST", headers: { authorization: "Bearer t" }, body }, res);
});

const { default: investigarApi } = await import("../api/investigar.js");
const { default: rodadaApi } = await import("../api/rodada.js");

for (const modelo of ["docs", "v2"]) {
  const banco = criarBanco(modelo, sementes());
  const usar = () => { process.env.DATA_MODEL = modelo; banco.instalar(login); };

  test(`[${modelo}] compartilhar: lê, guarda a sugestão na caixa e não lê a mesma de novo`, async () => {
    usar();
    const a = await chamar(investigarApi, { texto: "Caixa 2 PHP: frete inter 18,40 cada" });
    assert.equal(a.status, 200);
    assert.equal(a.corpo.ceg.nome, "Caixa 2 PHP");
    assert.equal(a.corpo.totalDevido, 23.4); // 5 da taxa + 18,40 novo
    const cx = [...banco.docs].find(([k]) => k.startsWith("caixa/app-"));
    assert.ok(cx, "sugestão guardada na caixa");
    assert.equal(cx[1].registros[0].estado, "pendente");
    assert.equal(cx[1].origem, "whatsapp");
    const b = await chamar(investigarApi, { texto: "Caixa 2 PHP: frete inter 18,40 cada" });
    assert.equal(b.corpo.repetido, true);
    assert.equal([...banco.docs].filter(([k]) => k.startsWith("caixa/")).length, 1);
  });

  test(`[${modelo}] rodada: CEG sem cadastro, CEG com forms, e não grava nada`, async () => {
    usar();
    const antes = JSON.stringify([...banco.docs]);
    assert.deepEqual((await chamar(rodadaApi, { ceg: "Não existe", comunidade: "Comunidade Azul" })).corpo, { cadastrada: false, temPlanilha: false });
    assert.deepEqual((await chamar(rodadaApi, { ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul" })).corpo, { cadastrada: true, temPlanilha: false });
    const f = (await chamar(rodadaApi, { ceg: "Com forms", comunidade: "Comunidade Azul" })).corpo;
    assert.equal(f.forms, true);
    assert.equal(JSON.stringify([...banco.docs]), antes);
  });

  test(`[${modelo}] sem login não passa`, async () => {
    process.env.DATA_MODEL = modelo;
    banco.instalar(() => ({ ok: false, status: 401, text: async () => "", json: async () => ({}) }));
    assert.equal((await chamar(investigarApi, { texto: "oi" })).status, 401);
  });
}

const { marcarFonte } = await import("./fontes.mjs");
for (const modelo of ["docs", "v2"]) test(`[${modelo}] cron: o carimbo de quando cada fonte foi lida fica em meta/fontes`, async () => {
  const banco = criarBanco(modelo, []);
  process.env.DATA_MODEL = modelo; banco.instalar(login);
  await marcarFonte("https://sb", "k", "dono", "catalogo", { nota: "3 novo(s)" });
  await marcarFonte("https://sb", "k", "dono", "planilhas", { erro: "caiu" });
  await marcarFonte("https://sb", "k", "dono", "catalogo", { nota: "0 novo(s)" });
  const f = banco.docs.get("meta/fontes");
  assert.equal(f.catalogo.nota, "0 novo(s)");
  assert.equal(f.planilhas.erro, "caiu");
});

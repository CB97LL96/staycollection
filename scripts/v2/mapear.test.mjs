// node --test scripts/v2/   (dados inventados, nada pessoal)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapear, valor, separarGoms } from "./mapear.mjs";

const doc = (col, id, data) => ({ col, id, data });
const exemplo = [
  doc("comunidades", "c1", { nome: "Comunidade Azul", apelido: "Azul", goms: "Gabi e Duda", pix: "chave-secreta", comprovante: "privado" }),
  doc("cegs", "g1", { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi", planilha: "https://exemplo/planilha" }),
  doc("cegs", "g2", { nome: "Variados", comunidade: "Comunidade Azul", gom: "Gabi" }),
  doc("cegs", "g3", { nome: "Variados", comunidade: "Outra", gom: "Ana" }),
  doc("itens", "i1", { item: "caixa 2 PHP", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", valor: "9,45", status: "Na WH / proxy", cards: ["karma-han-01", "karma-felix-01"] }),
  doc("itens", "i2", { item: "Han Aladin", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", status: "Recebido", cards: ["karma-han-01"], prova: "msg da GOM" }),
  doc("itens", "i3", { item: "SG linguinha", ceg: "CEG sem cadastro", comunidade: "Comunidade Azul", status: "Garantido" }),
  doc("itens", "i4", { item: "Variados 26", ceg: "Variados", status: "Garantido", etiquetas: "troca, bias", travado: ["status"], obs: "veio amassado" }),
  doc("acervo", "a1", { nome: "Lightstick", tipo: "Merch", st: "caminho" }),
  doc("cobrancas", "k1", { referente: "frete inter", comunidade: "Azul", ceg: "Caixa 2 PHP", valor: 18.4, prazo: "2026-11-27", status: "Pendente", pix: "x", grupo: "Avisos" }),
  doc("repasses", "r1", { item: "Felix repetido", pessoa: "Fulana", valor: "25", pago: true }),
  doc("envios", "e1", { gom: "Duda", comunidade: "Comunidade Azul", status: "Envio liberado", itens: "8 pcs" }),
  doc("fotos", "i3", { asset: "a".repeat(32) }),
  doc("fotos", "karma-han-01", { asset: "b".repeat(32) }),
  doc("caixa", "tg-1", { texto: "oi" }),
];
const { tabelas: t, relatorio: r } = mapear(exemplo, { cardIds: new Set(["karma-han-01"]) });
const um = (tab, id) => t[tab].find((x) => x.id === id);

test("valor lê vírgula como decimal, nunca 9,45 -> 945", () => {
  assert.equal(valor("9,45"), 9.45);
  assert.equal(valor("1.234,50"), 1234.5);
  assert.equal(valor("R$ 12"), 12);
  assert.equal(valor(""), null);
  assert.equal(valor("abc"), null);
});

test("GOMs separadas por 'e', vírgula ou barra", () => {
  assert.deepEqual(separarGoms("Gabi e Duda"), ["Gabi", "Duda"]);
  assert.deepEqual(separarGoms("Gabi, Duda / Ana"), ["Gabi", "Duda", "Ana"]);
});

test("pix e caminho de comprovante não entram no modelo novo", () => {
  const s = JSON.stringify(t);
  assert.ok(!s.includes("chave-secreta"));
  assert.ok(!s.includes('"pix"'));
  assert.equal(r.semPix, 2);
});

test("CEG ligada à GOM e à comunidade por id", () => {
  const g = um("cegs", "ceg-g1");
  assert.equal(g.comunidade_id, "com-c1");
  assert.equal(t.goms.find((x) => x.id === g.gom_id).nome, "Gabi");
  assert.equal(t.goms.filter((x) => x.comunidade_id === "com-c1").length, 2); // Gabi e Duda, sem duplicar
});

test("uma claim com dois cards vira dois itens apontando pra mesma claim", () => {
  const its = t.itens.filter((x) => x.claim_id === "claim-i1");
  assert.equal(its.length, 2);
  assert.deepEqual(its.map((x) => x.card_id).sort(), ["karma-felix-01", "karma-han-01"]);
  assert.equal(um("claims", "claim-i1").valor, 9.45);
  assert.equal(um("claims", "claim-i1").texto, "caixa 2 PHP");
});

test("repetido: duas cópias ativas do mesmo card", () => {
  assert.equal(r.repetidos, 1);
});

test("CEG citada sem cadastro é criada e avisada", () => {
  assert.ok(r.criadas.cegs.some((x) => x.startsWith("CEG sem cadastro")));
  assert.equal(um("itens", "item-i3").foto, "a".repeat(32));
});

test("CEG com o mesmo nome em duas comunidades, sem comunidade citada, vai pro relatório", () => {
  assert.deepEqual(r.cegAmbigua, ["Variados"]);
});

test("comunidade achada pelo apelido; cobrança sem pix, com onde olhar", () => {
  const c = um("cobrancas", "cob-k1");
  assert.equal(c.comunidade_id, "com-c1");
  assert.equal(c.ceg_id, "ceg-g1");
  assert.equal(c.onde_olhar, "Avisos");
  assert.equal(c.legado.pix, undefined);
});

test("repasse vira cobrança a receber", () => {
  const c = um("cobrancas", "rep-r1");
  assert.equal(c.direcao, "receber");
  assert.equal(c.status, "Paga");
  assert.equal(c.valor, 25);
});

test("acervo, envio, foto de card e o que fica no app antigo", () => {
  assert.equal(um("itens", "acervo-a1").origem, "acervo");
  assert.equal(um("envios", "env-e1").notas, "itens: 8 pcs");
  assert.deepEqual(t.card_fotos, [{ card_id: "karma-han-01", foto: "b".repeat(32) }]);
  assert.equal(r.fora.caixa, 1);
  assert.equal(t.provas.length, 1);
});

test("rodar duas vezes dá os mesmos ids", () => {
  const de_novo = mapear(exemplo, { cardIds: new Set(["karma-han-01"]) }).tabelas;
  assert.deepEqual(de_novo.cegs.map((x) => x.id), t.cegs.map((x) => x.id));
  assert.deepEqual(de_novo.goms.map((x) => x.id), t.goms.map((x) => x.id));
});

test("etiquetas, campos travados e notas dela vão pro item novo", () => {
  const it = t.itens.find((x) => x.id === "item-i4");
  assert.deepEqual(it.etiquetas, ["troca", "bias"]);
  assert.deepEqual(it.travado, ["status"]);
  assert.equal(it.notas, "veio amassado");
});

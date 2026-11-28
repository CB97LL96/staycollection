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
const { tabelas: t, relatorio: r } = mapear(exemplo);
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

test("acervo, envio, foto por chave e caixa: nada fica de fora", () => {
  assert.equal(um("itens", "acervo-a1").origem, "acervo");
  assert.equal(um("envios", "env-e1").itens_txt, "8 pcs");
  assert.deepEqual(t.card_fotos.map((x) => [x.card_id, x.foto]).sort(), [["i3", "a".repeat(32)], ["karma-han-01", "b".repeat(32)]]);
  assert.equal(t.sugestoes.length, 1); // a caixa do robô
  assert.equal(t.provas.length, 1);
});

test("rodar duas vezes dá os mesmos ids", () => {
  const de_novo = mapear(exemplo).tabelas;
  assert.deepEqual(de_novo.cegs.map((x) => x.id), t.cegs.map((x) => x.id));
  assert.deepEqual(de_novo.goms.map((x) => x.id), t.goms.map((x) => x.id));
});

test("etiquetas, campos travados e notas dela vão pro item novo", () => {
  const it = t.itens.find((x) => x.id === "item-i4");
  assert.deepEqual(it.etiquetas, ["troca", "bias"]);
  assert.deepEqual(it.travado, ["status"]);
  assert.equal(it.notas, "veio amassado");
});

// ---------- ida e volta: documento -> tabelas -> documento ----------
import { paraDocs, escrever, apagarDoc, mapas, semPix } from "./mapear.mjs";
const tudo = [
  ...exemplo,
  doc("cobrancas", "k2", { referente: "taxa", comunidade: "Azul", valor: "1.234,50", status: "Paga", pagoEm: "2026-11-02", comprovanteAsset: "c".repeat(32), pagoProva: "comprovante PicPay", prova: "chat", travado: ["valor"] }),
  doc("caixa", "tg-2", { origem: "telegram", recebidoEm: "2026-11-27T10:00:00.000Z", estado: "lida", registros: [{ alvo: "i2", estado: "pendente" }], ceg: { id: "g1", nome: "Caixa 2 PHP" }, totalDevido: 12.5, fonte: "texto" }),
  doc("quadros", "q1", { gom: "Gabi", com: "Azul", rasc: { r1: { asset: "d".repeat(32) } }, notas: { n1: { t: "x" } } }),
  doc("binder", "meta", { n: { a: 2 }, tr: ["a"], g: [{ id: 1 }] }),
  doc("colecao", "han", { s: { a: "tenho", b: "quero" } }),
  doc("cardsnovos", "n1", { m: "HAN", e: "E", v: "V", t: "POB" }),
  doc("meta", "fontes", { bot: { em: "2026-11-01" } }),
  doc("mural", "m1", { qualquer: "coisa" }),
  doc("gruposwa", "w1", { nome: "Grupo A", comunidade: "Azul", cat: "claim" }),
];
const ordena = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v)));
const T = mapear(tudo).tabelas;

test("ida e volta: o documento volta igual (menos pix)", () => {
  const volta = paraDocs(T);
  for (const d of tudo) assert.deepEqual(ordena(volta[d.col].get(d.id)), ordena(semPix(d.data)), `${d.col}/${d.id}`);
});

test("renomear a CEG não quebra o item (o nome vem da CEG)", () => {
  const T2 = JSON.parse(JSON.stringify(T)); T2.cegs.find((c) => c.id === "ceg-g1").nome = "Caixa 3";
  assert.equal(paraDocs(T2).itens.get("i1").ceg, "Caixa 3");
  assert.equal(paraDocs(T2).cobrancas.get("k1").ceg, "Caixa 3");
});

test("escrever: editar o status de um item muda todos os itens da claim e guarda o histórico", () => {
  const atual = paraDocs(T).itens.get("i1");
  const r = escrever("itens", "i1", { ...atual, status: "Recebido" }, T, { hoje: "2026-11-28" });
  assert.deepEqual(r.up.itens.map((x) => x.status), ["Recebido", "Recebido"]);
  assert.equal(r.up.item_status.length, 2);
  assert.equal(r.up.item_status[0].em, "2026-11-28");
  const i4 = paraDocs(T).itens.get("i4");
  assert.deepEqual(escrever("itens", "i4", { ...i4, status: "Recebido" }, T).up.claims[0].travado, ["status"]); // o travado dela segue valendo
});

test("escrever: tirar um card da lista apaga só aquele item; pôr um novo cria sem mexer nos ids", () => {
  const atual = paraDocs(T).itens.get("i1");
  const r1 = escrever("itens", "i1", { ...atual, cards: ["karma-han-01"] }, T);
  assert.deepEqual(r1.del.itens.map((x) => x.id), ["item-i1-2"]);
  const r2 = escrever("itens", "i1", { ...atual, cards: ["karma-han-01", "karma-felix-01", "c"] }, T);
  assert.equal(r2.up.itens.length, 3);
  assert.deepEqual(r2.up.itens.slice(0, 2).map((x) => x.id), ["item-i1-1", "item-i1-2"]);
  assert.equal(r2.up.itens[2].id, "item-i1-3");
});

test("escrever: documento novo cita CEG que não existe, e ela é criada por id", () => {
  const r = escrever("itens", "nov", { item: "Han Aladin", ceg: "CEG nova", comunidade: "Azul", status: "Garantido", cards: ["karma-han-01"] }, T);
  assert.equal(r.up.cegs.length, 1);
  assert.equal(r.up.claims[0].ceg_id, r.up.cegs[0].id);
  assert.ok(!r.up.comunidades); // a comunidade já existia: não recria nem sobrescreve
});

test("escrever nunca grava pix e apagar leva as provas junto", () => {
  const r = escrever("cobrancas", "z", { referente: "x", pix: "segredo", comprovante: "y" }, T);
  assert.ok(!JSON.stringify(r).includes("segredo"));
  const a = apagarDoc("cobrancas", "k2", T);
  assert.deepEqual(a.del.provas.map((x) => x.id).sort(), ["prova-cobrancas-cob-k2", "prova-comp-cob-k2"]);
  assert.deepEqual(a.del.cobrancas, [{ id: "cob-k2" }]);
});

test("colecao: tirar o estado de um card apaga só aquela linha", () => {
  const r = escrever("colecao", "han", { s: { a: "tenho" } }, T);
  assert.deepEqual(r.del.posse, [{ card_id: "b" }]);
});

test("pix some do documento que volta (o app antigo guarda o dele)", () => {
  assert.equal(paraDocs(T).comunidades.get("c1").pix, undefined);
});

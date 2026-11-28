import test from "node:test";
import assert from "node:assert/strict";
import { norm, urlOk, fonteIrmaos, fontePoca, fonteExtra, fonteWiki, juntarCandidatos, precisaProcurar, montarSugestao, cacarFotos, cardsDela } from "./fotos-core.mjs";

const card = (i, o = {}) => ({ i, m: "Han", e: "Karma", t: "Álbum", o: "KR", v: "Ceremony ver.", s: "001", ...o });
const boa = (i, o = {}) => card(i, { u: "https://exemplo.com/" + i + ".webp", w: 700, ...o });

test("urlOk segue a regra do app", () => {
  assert.ok(urlOk("https://exemplo.com/a/b.jpg"));
  assert.ok(!urlOk("http://exemplo.com/a.jpg"));
  assert.ok(!urlOk("https://exemplo.com/a (1).jpg"));
});

test("irmãos: mesmo membro+era+versão com foto boa; tipo igual vale mais", () => {
  const todos = [card("a"), boa("b", { t: "POB" }), boa("c")];
  const r = fonteIrmaos([todos[0]], todos).get("a");
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => x.url.includes("/c.")).nota, 80);
  assert.equal(r.find((x) => x.url.includes("/b.")).nota, 55);
});

test("irmãos: não sugere foto fraca nem de outro membro", () => {
  const todos = [card("a"), boa("b", { m: "Felix" }), card("c", { u: "https://exemplo.com/c.webp", w: 120 })];
  assert.equal(fonteIrmaos([todos[0]], todos).size, 0);
});

test("POCA: só álbum, e só se era e versão batem; nota baixa", () => {
  const loja = [{ nome: "Stray Kids [KARMA] (Ceremony Ver.)", imagem: "https://exemplo.com/p.jpg" }, { nome: "Outro [X]", imagem: "https://exemplo.com/q.jpg" }];
  assert.equal(fontePoca([card("a")], loja).get("a")[0].nota, 30);
  assert.equal(fontePoca([card("b", { t: "POB" })], loja).size, 0);
});

test("extra: link guardado à mão tem nota alta e ignora link ruim", () => {
  const r = fonteExtra([card("a")], { a: [{ url: "https://exemplo.com/x.jpg" }, { url: "http://x.com/y.jpg" }] });
  assert.equal(r.get("a").length, 1);
  assert.equal(r.get("a")[0].nota, 95);
});

test("wiki: só aceita arquivo com membro, era e 'photocard' no nome", async () => {
  const pages = { 1: { title: "File:Karma Han photocard Ceremony.jpg", imageinfo: [{ url: "https://exemplo.com/w1.jpg", width: 800, height: 1200 }] }, 2: { title: "File:Karma Felix photocard.jpg", imageinfo: [{ url: "https://exemplo.com/w2.jpg", width: 800, height: 1200 }] } };
  const r = await fonteWiki([card("a")], { fetchJson: async () => ({ query: { pages } }) });
  assert.deepEqual(r.get("a").map((x) => x.url), ["https://exemplo.com/w1.jpg"]);
});

test("ranking: largura boa sobe, descartadas e repetidas somem, máximo 5", () => {
  const l = [
    { url: "https://exemplo.com/1.jpg", fonte: "poca", nota: 30, w: null },
    { url: "https://exemplo.com/2.jpg", fonte: "wiki", nota: 75, w: 800 },
    { url: "https://exemplo.com/2.jpg", fonte: "wiki", nota: 75, w: 800 },
    { url: "https://exemplo.com/3.jpg", fonte: "wiki", nota: 75, w: 100 },
    { url: "https://exemplo.com/4.jpg", fonte: "irmao", nota: 80 },
  ];
  const r = juntarCandidatos([l], { nao: ["https://exemplo.com/4.jpg"] });
  assert.deepEqual(r.map((x) => x.url.slice(-5)), ["2.jpg", "3.jpg", "1.jpg"]);
  assert.equal(r[0].nota, 85);
  assert.equal(juntarCandidatos([Array.from({ length: 9 }, (_, i) => ({ url: `https://exemplo.com/${i}.jpg`, fonte: "wiki", nota: 50 }))]).length, 5);
});

test("fila: foto escolhida por ela e foto boa ficam de fora; sem achado volta em 7 dias", () => {
  const agora = Date.parse("2026-12-10T00:00:00Z");
  assert.ok(!precisaProcurar(card("a"), { fotos: { a: { url: "https://exemplo.com/z.jpg", trava: true } }, sug: {}, agora }));
  assert.ok(!precisaProcurar(boa("a"), { fotos: {}, sug: {}, agora }));
  assert.ok(precisaProcurar(card("a"), { fotos: {}, sug: {}, agora }));
  assert.ok(!precisaProcurar(card("a"), { fotos: {}, sug: { a: { c: [], tentouEm: "2026-12-08T00:00:00Z" } }, agora }));
  assert.ok(precisaProcurar(card("a"), { fotos: {}, sug: { a: { c: [], tentouEm: "2026-12-02T00:00:00Z" } }, agora }));
});

test("rodar de novo não duplica nem regrava e preserva o que ela descartou", async () => {
  const colecao = { items: [card("a"), boa("b")] };
  const extra = { a: [{ url: "https://exemplo.com/x.jpg", w: 600 }, { url: "https://exemplo.com/y.jpg", w: 600 }] };
  const base = { colecao, cards: colecao.items, fotos: {}, loja: [], extra, fetchJson: async () => ({}) };
  const r1 = await cacarFotos(base);
  assert.equal(r1.linhas.length >= 1, true);
  const linha = r1.linhas.find(([id]) => id === "a")[1];
  assert.equal(linha.c.length, 3); // x, y e o irmão b
  const sug = Object.fromEntries(r1.linhas);
  const r2 = await cacarFotos({ ...base, sug });
  assert.equal(r2.linhas.length, 0);
  sug.a = { ...sug.a, c: sug.a.c.filter((x) => !x.url.endsWith("x.jpg")), nao: ["https://exemplo.com/x.jpg"] };
  const r3 = await cacarFotos({ ...base, sug });
  assert.ok(!r3.linhas.some(([, s]) => s.c.some((x) => x.url.endsWith("x.jpg"))));
});

test("cardsDela junta pedidos ligados e marcas do binder", () => {
  const col = { items: [card("a"), card("b"), card("c")] };
  assert.deepEqual(cardsDela(col, { 1: { cards: ["a"] } }, { han: { s: { b: "tenho" } } }).map((c) => c.i), ["a", "b"]);
});

test("montarSugestao guarda tentouEm e achouEm só com candidato", () => {
  const s = montarSugestao(card("a"), [], null, new Date("2026-12-01T00:00:00Z"));
  assert.equal(s.c.length, 0); assert.ok(s.tentouEm); assert.ok(!s.achouEm);
});

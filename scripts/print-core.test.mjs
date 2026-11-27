import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizar } from "./print-core.mjs";
test("normaliza caixas: ordem, limites e descarta lixo", () => {
  const r = normalizar({ resumo: "x", cards: [
    { caixa: [500, 600, 100, 200], tipo: "photocard", membro: "HAN", nome: "Aladin", numero: "26", legivel: true },
    { caixa: [0, 0, 10, 10], tipo: "photocard", membro: "", nome: "", numero: "", legivel: true },
    { caixa: [1, 2, 3], tipo: "merch", membro: "", nome: "", numero: "", legivel: true },
    { caixa: [-50, 0, 1200, 300], tipo: "merch", membro: null, nome: "x", numero: "", legivel: false },
  ] });
  assert.equal(r.cards.length, 2);
  assert.deepEqual(r.cards[0].caixa, [100, 200, 500, 600]);
  assert.deepEqual(r.cards[1].caixa, [0, 0, 1000, 300]);
  assert.equal(r.cards[1].membro, "");
});

import { sugerir } from "./print-core.mjs";
const CAT = [
  { i: "a-han-01", m: "HAN", e: "Era Azul", o: "KR", t: "Álbum", v: "Aladin", s: "001" },
  { i: "a-han-26", m: "HAN", e: "Era Azul", o: "KR", t: "Álbum", v: "Aladin", s: "026" },
  { i: "p-han-02", m: "HAN", e: "Era Azul", o: "KR", t: "POB", v: "Loja Lua", s: "002" },
  { i: "ld-han-03", m: "HAN", e: "Era Verde", o: "JP", t: "Lucky draw", v: "Estrela", s: "003" },
  { i: "a-felix-01", m: "Felix", e: "Era Azul", o: "KR", t: "Álbum", v: "Aladin", s: "001" },
  { i: "u-01", m: "UNIT", e: "Era Azul", o: "KR", t: "Álbum", v: "Rodinha", s: "001" },
];
test("sugerir: membro obrigatório, número desempata e nota ordena", () => {
  const r = sugerir({ membro: "han", nome: "Aladin", numero: "26", tipo: "photocard" }, CAT);
  assert.equal(r[0].i, "a-han-26");
  assert.ok(r.every((c) => !c.i.includes("felix")));
  assert.ok(r[0].nota > r[1].nota && r[0].nota <= 1);
});
test("sugerir: sinônimos (LD, POB), acento e no máximo 3", () => {
  assert.equal(sugerir({ membro: "HAN", nome: "ld estrela", numero: "", tipo: "photocard" }, CAT)[0].i, "ld-han-03");
  assert.equal(sugerir({ membro: "HAN", nome: "POB lua", numero: "", tipo: "photocard" }, CAT)[0].i, "p-han-02");
  assert.ok(sugerir({ membro: "", nome: "aladin", numero: "", tipo: "photocard" }, CAT).length <= 3);
});
test("sugerir: sem texto nem número, ou sem acerto, não sugere nada", () => {
  assert.deepEqual(sugerir({ membro: "HAN", nome: "", numero: "", tipo: "photocard" }, CAT), []);
  assert.deepEqual(sugerir({ membro: "HAN", nome: "zzzz", numero: "", tipo: "photocard" }, CAT), []);
  assert.deepEqual(sugerir({ membro: "Seungmin", nome: "Aladin", numero: "1", tipo: "photocard" }, CAT), []);
});

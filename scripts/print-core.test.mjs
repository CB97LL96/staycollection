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

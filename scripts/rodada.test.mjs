// node --test scripts/rodada.test.mjs  (dados inventados)
import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoPlanilha, limpar } from "./rodada-core.mjs";

const abas = [{ aba: "Frete", cabecalho: "nome;item;valor", dela: ["Lari;frete;18,40", "Lari;taxa;9,90", "Lari;pix;chave@exemplo.com", "Lari;pix 11999998888;1"] }, { aba: "Itens", cabecalho: "x", dela: Array.from({ length: 12 }, (_, i) => "Lari;card " + i) }];

test("resumo: linhas dela, valor achado, pix e dados pessoais nunca saem", () => {
  const r = resumoPlanilha(abas, [{ id: "k1", valor: 18.4 }, { id: "k2", valor: 77 }, { id: "k3", valor: null }]);
  assert.equal(r.achouNome, true);
  assert.deepEqual(r.cobrancas, [{ id: "k1", achou: true }, { id: "k2", achou: false }, { id: "k3", achou: null }]);
  const txt = JSON.stringify(r);
  assert.doesNotMatch(txt, /chave@exemplo|11999998888/);
  assert.match(txt, /omitida/);
  assert.equal(r.abas[1].linhas.length, 8);
  assert.equal(r.abas[1].mais, 4);
});
test("resumo: nome não aparece", () => {
  const r = resumoPlanilha([], [{ id: "k1", valor: 5 }]);
  assert.equal(r.achouNome, false);
  assert.deepEqual(r.cobrancas, [{ id: "k1", achou: false }]);
});
test("limpar: cpf e uuid", () => {
  assert.match(limpar("Lari 123.456.789-09"), /omitida/);
  assert.match(limpar("a1b2c3d4-0000-4000-8000-123456789abc"), /omitida/);
  assert.equal(limpar("  Lari   frete  "), "Lari frete");
});

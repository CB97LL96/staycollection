// node --test scripts/v2/migracao.test.mjs
// O caminho inteiro da migração com dados inventados: migrar -> verificar ->
// usar no v2 -> voltar pro antigo sem perder nada. Sem rede nem banco.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapear, paraDocs, escrever, apagarDoc, pkVal, ORDEM, TABELAS } from "./mapear.mjs";
import { verificar, planoDeVolta } from "./verificar-core.mjs";
import { exemplo } from "./exemplo.mjs";

const copia = (x) => JSON.parse(JSON.stringify(x));
// aplica o que o adaptador mandaria gravar, nas linhas locais (como o banco faria)
function aplicar(T, r) {
  for (const [t, rows] of Object.entries(r.up || {})) for (const row of rows) {
    const i = T[t].findIndex((x) => pkVal(t, x) === pkVal(t, row));
    if (i >= 0) T[t][i] = { ...T[t][i], ...row }; else T[t].push(row);
  }
  for (const [t, rows] of Object.entries(r.del || {})) for (const row of rows) T[t] = T[t].filter((x) => pkVal(t, x) !== pkVal(t, row));
}
const vazias = () => Object.fromEntries(TABELAS.map((t) => [t, []]));

test("migrar: o relatório é completo e a verificação passa", () => {
  const { tabelas, relatorio: r } = mapear(exemplo);
  assert.ok(r.semPix >= 2);
  assert.ok(r.citadas.cegs.some((x) => x.startsWith("CEG sem cadastro")));
  const v = verificar(exemplo, tabelas);
  assert.equal(v.problemas, 0, v.linhas.join("\n"));
  assert.ok(v.linhas.some((l) => /total devido/.test(l)));
});

test("verificar falha quando o total, a foto ou um registro diverge", () => {
  const { tabelas } = mapear(exemplo);
  const t1 = copia(tabelas); t1.cobrancas.find((c) => c.id === "cob-k1").valor = 19;
  assert.ok(verificar(exemplo, t1).problemas >= 2); // o total e o registro
  const t2 = copia(tabelas); t2.card_fotos = t2.card_fotos.slice(1);
  assert.ok(!verificar(exemplo, t2).ok);
  const t3 = copia(tabelas); t3.claims = t3.claims.filter((c) => c.id !== "claim-i2");
  const v3 = verificar(exemplo, t3);
  assert.ok(!v3.ok && v3.linhas.some((l) => /itens.*FALHA|FALHA.*itens/.test(l) || /falta no novo/.test(l)));
});

test("rodar a migração de novo não muda nada (mesmas linhas)", () => {
  assert.deepEqual(mapear(exemplo).tabelas, mapear(copia(exemplo)).tabelas);
});

test("migrar -> usar no v2 -> voltar pro antigo: nada se perde", () => {
  const T = copia(mapear(exemplo).tabelas);
  // ---- usar o app no v2 ----
  const doc = (col, id) => paraDocs(T)[col].get(id);
  aplicar(T, escrever("itens", "i1", { ...doc("itens", "i1"), status: "Recebido", obs: "chegou" }, T, { hoje: "2026-11-28" }));
  aplicar(T, escrever("cobrancas", "nova1", { referente: "frete nacional", comunidade: "Comunidade Azul", ceg: "Caixa 2 PHP", valor: 12.9, status: "Pendente", pix: "nao-deve-entrar" }, T));
  aplicar(T, apagarDoc("cobrancas", "k1", T));
  aplicar(T, escrever("comunidades", "c1", { ...doc("comunidades", "c1"), apelido: "Azulzinha" }, T));
  aplicar(T, escrever("colecao", "han", { s: { "karma-han-01": "tenho" } }, T)); // tirou um card
  aplicar(T, escrever("cegs", "g1", { ...doc("cegs", "g1"), nome: "Caixa 2 renomeada" }, T)); // renomear não quebra o item
  aplicar(T, escrever("fotos", "karma-han-01", { asset: "e".repeat(32) }, T));
  assert.ok(!JSON.stringify(T).includes("nao-deve-entrar"));
  assert.equal(doc("itens", "i1").ceg, "Caixa 2 renomeada");

  // ---- voltar ----
  const plano = planoDeVolta(exemplo, T);
  assert.ok(plano.temV2);
  const final = new Map(exemplo.map((d) => [`${d.col}/${d.id}`, copia(d.data)]));
  [...plano.criar, ...plano.atualizar].forEach((x) => final.set(`${x.col}/${x.id}`, x.data));
  plano.sobrando.forEach((x) => final.delete(`${x.col}/${x.id}`));
  const get = (k) => final.get(k);
  assert.equal(get("itens/i1").status, "Recebido");
  assert.equal(get("itens/i1").ceg, "Caixa 2 renomeada");
  assert.equal(get("comunidades/c1").apelido, "Azulzinha");
  assert.equal(get("comunidades/c1").pix, "chave-secreta"); // o pix do antigo continua lá
  assert.equal(get("cobrancas/k2").pagarComo, "x");          // e o resto do dinheiro também
  assert.ok([...final].some(([k, d]) => k.startsWith("cobrancas/") && d.referente === "frete nacional" && !("pix" in d)));
  assert.deepEqual(plano.sobrando.map((x) => `${x.col}/${x.id}`), ["cobrancas/k1"]); // apagada no v2
  assert.deepEqual(get("colecao/han").s, { "karma-han-01": "tenho" });
  assert.equal(get("fotos/karma-han-01").asset, "e".repeat(32));
  // o que não foi mexido continua igual
  for (const k of ["acervo/a1", "repasses/r1", "envios/e1", "caixa/tg-1", "quadros/q1", "binder/meta", "cardsnovos/n1", "meta/fontes", "mural/m1"]) {
    assert.deepEqual(get(k), exemplo.find((d) => `${d.col}/${d.id}` === k).data, k);
  }
  // o grupo escrito com o apelido antigo ("Azul") passa a usar o nome inteiro, já que o apelido mudou
  assert.equal(get("gruposwa/w1").comunidade, "Comunidade Azul");
  // ida de novo: migrar o resultado dá o mesmo v2
  const { tabelas: T2 } = mapear([...final].map(([k, data]) => ({ col: k.split("/")[0], id: k.slice(k.indexOf("/") + 1), data })));
  const v = verificar([...final].map(([k, data]) => ({ col: k.split("/")[0], id: k.slice(k.indexOf("/") + 1), data })), T2);
  assert.equal(v.problemas, 0, v.linhas.join("\n"));
});

test("voltar sem nada no v2 avisa (não apaga o antigo)", () => {
  assert.equal(planoDeVolta(exemplo, vazias()).temV2, false);
});

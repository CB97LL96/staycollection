// node --test --experimental-test-module-mocks scripts/investigar.fluxo.test.mjs
// O fluxo inteiro do investigar, com a IA e a planilha simuladas.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

let prompt = "";
mock.module("./ia.mjs", { namedExports: { gerarJson: async ({ texto }) => {
  prompt = texto;
  return { modelo: "falso", json: { resumo: "frete inter liberado", ceg: "Caixa 2 PHP", pergunta: "", mudancas: [
    { acao: "nova", alvo: "", destino: "cobrancas", referente: "frete inter", tipo: "Frete internacional", membro: "", valor: 18.4, prazo: "2026-11-27", status: "Pendente", base: "os dois", trecho: "Lari;frete;18,40", confianca: "alta", duvidas: "" },
  ] } };
} } });
mock.module("./conferir-cobrancas.mjs", { namedExports: {
  baixarPlanilha: async () => [{ aba: "Frete", texto: "nome;item;valor\nLari;frete;18,40\nOutra;frete;20,00" }],
  linhasDela: (abas, nomes) => abas.map((a) => ({ aba: a.aba, cabecalho: a.texto.split("\n")[0], dela: a.texto.split("\n").slice(1).filter((l) => nomes.some((n) => l.includes(n))) })),
} });
const { investigar, respostaTelegram } = await import("./investigar.mjs");

const doc = (col, id, data) => ({ col, id, data });
const docs = [
  doc("comunidades", "c1", { nome: "Comunidade Azul", goms: "Gabi" }),
  doc("cegs", "g1", { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi", planilha: "https://docs.google.com/spreadsheets/d/abc/edit", obs: "só envia depois do dia 10" }),
  doc("itens", "i9", { item: "Han Aladin", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", status: "Garantido", obs: "veio amassado", travado: ["status"] }),
  doc("cobrancas", "k2", { referente: "taxa", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", valor: 5, status: "Pendente", pix: "segredo" }),
];

test("investiga: dossiê com planilha e notas vai pra IA, resposta sai com total", async () => {
  const r = await investigar({ texto: "Caixa 2 PHP: frete inter liberado, valor na planilha, prazo sexta" }, docs, { nomes: ["Lari"], hoje: "2026-11-24" });
  assert.match(prompt, /\[cobranca k2\] taxa/);
  assert.match(prompt, /Lari;frete;18,40/);
  assert.doesNotMatch(prompt, /Outra;frete/);       // linha de outra pessoa não vai
  assert.match(prompt, /só envia depois do dia 10/); // nota dela vira contexto
  assert.doesNotMatch(prompt, /segredo/);            // pix nunca vai pra IA
  assert.match(prompt, /nota dela: veio amassado \| ela travou: status\n/);
  assert.doesNotMatch(prompt, /\}/);
  assert.equal(r.totalDevido, 23.4);                 // 5 da taxa + 18,40 novo
  const txt = respostaTelegram(r);
  assert.match(txt, /CEG Caixa 2 PHP · GOM Gabi/);
  assert.match(txt, /Conferido na planilha: Frete/);
});

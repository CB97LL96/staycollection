// node --test scripts/investigar.test.mjs   (dados inventados)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapear } from "./v2/mapear.mjs";
import { acharCeg, dossie, montar, respostaTelegram, grupoDoArquivo } from "./investigar.mjs";
import { aceitarTodas, registroParaDoc } from "./aceitar.mjs";

const doc = (col, id, data) => ({ col, id, data });
const docs = [
  doc("comunidades", "c1", { nome: "Comunidade Azul", apelido: "Azul", goms: "Gabi" }),
  doc("cegs", "g1", { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi", grupo: "Azul • Caixa 2 PHP", planilha: "" }),
  doc("cegs", "g2", { nome: "Variados 7", comunidade: "Comunidade Azul", gom: "Gabi" }),
  doc("cegs", "g3", { nome: "Set antigo", comunidade: "Comunidade Azul", status: "Concluída" }),
  doc("itens", "i1", { item: "caixa 2", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", status: "Na WH / proxy", cards: ["a", "b"] }),
  doc("cobrancas", "k1", { referente: "item caixa 2", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", valor: 60, status: "Paga" }),
  doc("cobrancas", "k2", { referente: "taxa", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", valor: 5, status: "Pendente" }),
  doc("repasses", "r1", { item: "repasse", ceg: "Caixa 2 PHP", valor: 30 }),
];
const { tabelas: t } = mapear(docs);

test("acha a CEG pelo nome do grupo no .txt", () => {
  assert.equal(grupoDoArquivo("Conversa do WhatsApp com Azul • Caixa 2 PHP.txt"), "Azul • Caixa 2 PHP");
  const c = acharCeg({ texto: "oi", nomeArquivo: "Conversa do WhatsApp com Azul • Caixa 2 PHP.txt" }, t);
  assert.equal(c[0].ceg.nome, "Caixa 2 PHP");
});

test("acha a CEG citada no texto e ignora o que não tem pista", () => {
  const c = acharCeg({ texto: "Frete da variados 7 liberado!" }, t);
  assert.equal(c[0].ceg.nome, "Variados 7");
  assert.equal(acharCeg({ texto: "bom dia gente" }, t).length, 0);
});

test("dossiê não traz repasse como cobrança a pagar", () => {
  const d = dossie(t.cegs.find((c) => c.nome === "Caixa 2 PHP"), t);
  assert.deepEqual(d.cobs.map((c) => c.id).sort(), ["cob-k1", "cob-k2"]);
  assert.equal(d.claims.length, 1);
});

const d = { ...dossie(t.cegs.find((c) => c.nome === "Caixa 2 PHP"), t), planilha: { abas: ["Frete"] } };
const mud = (x) => ({ alvo: "", destino: "cobrancas", referente: "", tipo: "", membro: "", valor: null, prazo: "", status: "", base: "mensagem", trecho: "t", confianca: "alta", duvidas: "", ...x });

test("montar: descarta alvo inventado e calcula o total devido", () => {
  const r = montar({ resumo: "ok", ceg: "Caixa 2 PHP", pergunta: "", mudancas: [
    mud({ acao: "nova", referente: "frete inter", tipo: "Frete internacional", valor: 18.4, prazo: "2026-11-27" }),
    mud({ acao: "paga", alvo: "k2" }),
    mud({ acao: "valor", alvo: "nao-existe", valor: 1 }),
    mud({ acao: "status", alvo: "i1", status: "Com a GOM no Brasil", destino: "cobrancas" }),
    mud({ acao: "nova", referente: "frete nacional", confianca: "media", valor: 10 }),
  ] }, d);
  assert.equal(r.registros.length, 4);
  assert.equal(r.registros.find((x) => x.acao === "status").destino, "itens");
  assert.equal(r.totalDevido, 18.4); // taxa paga, frete inter novo; o de confiança média não soma
  const txt = respostaTelegram(r);
  assert.match(txt, /Você deve nesta CEG: R\$ 18,40/);
  assert.match(txt, /1 item agora: Com a GOM no Brasil/);
  assert.match(txt, /Conferido na planilha: Frete/);
  assert.doesNotMatch(txt, /pix/i);
});

test("montar sem CEG devolve a pergunta", () => {
  const r = montar({ resumo: "não sei", ceg: "", pergunta: "É da Caixa 2 ou da Variados 7?", mudancas: [] }, null, { cands: [] });
  assert.equal(r.totalDevido, null);
  assert.equal(respostaTelegram(r), "É da Caixa 2 ou da Variados 7?");
});

test("aceitar pelo Telegram grava no app como o botão do app, sem pix", async () => {
  const banco = {
    caixa: { recebidoEm: "2026-11-24T10:00:00Z", registros: [
      { acao: "nova", destino: "cobrancas", referente: "frete inter", valor: 18.4, confianca: "alta", estado: "pendente", comunidade: "Comunidade Azul", ceg: "Caixa 2 PHP" },
      { acao: "paga", alvo: "k2", destino: "cobrancas", estado: "pendente" },
      { acao: "status", alvo: "i1", destino: "itens", status: "Com a GOM no Brasil", estado: "pendente" },
      { acao: "valor", alvo: "sumiu", destino: "cobrancas", valor: 3, estado: "pendente" },
    ] },
    k2: { referente: "taxa", status: "Pendente", valor: 5 }, i1: { item: "caixa 2", status: "Na WH / proxy" },
  };
  const gravados = [];
  const rest = async (path, opts = {}) => {
    const id = decodeURIComponent((path.match(/&id=eq\.([^&]+)/) || [])[1] || "");
    if (!opts.method) return banco[id === "tg-1" ? "caixa" : id] ? [{ data: banco[id === "tg-1" ? "caixa" : id] }] : [];
    gravados.push({ path, metodo: opts.method, corpo: JSON.parse(opts.body) });
    return null;
  };
  const r = await aceitarTodas(rest, "dono", "tg-1");
  assert.deepEqual(r, { ok: 3, falhas: 1 });
  const nova = gravados.find((g) => g.metodo === "POST").corpo;
  assert.equal(nova.col, "cobrancas");
  assert.equal(nova.data.status, "Pendente");
  assert.ok(!("pix" in nova.data));
  assert.equal(gravados.find((g) => g.path.includes("id=eq.k2")).corpo.data.status, "Paga");
  assert.equal(gravados.find((g) => g.path.includes("id=eq.i1")).corpo.data.status, "Com a GOM no Brasil");
  const cx = gravados.at(-1).corpo.data.registros;
  assert.deepEqual(cx.map((x) => x.estado), ["aceito", "aceito", "aceito", "pendente"]);
});

test("registro de confiança média entra como 'A confirmar'", () => {
  assert.equal(registroParaDoc({ destino: "cobrancas", confianca: "media" }, {}).status, "A confirmar");
});

test("dossiê mostra a nota dela e o campo travado, sem pix", () => {
  const { tabelas: t2 } = mapear([
    doc("cegs", "g1", { nome: "Caixa 2 PHP" }),
    doc("itens", "i1", { item: "Han Aladin", ceg: "Caixa 2 PHP", status: "Garantido", obs: "só vem depois do dia 10", travado: ["status"], pix: "segredo" }),
  ]);
  const d2 = dossie(t2.cegs[0], t2);
  const l = d2.claims.map((cl) => `${cl.notas}|${cl.legado.travado}`).join();
  assert.equal(l, "só vem depois do dia 10|status");
  assert.ok(!JSON.stringify(d2).includes("segredo"));
});

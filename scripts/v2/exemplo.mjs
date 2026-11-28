// Dados INVENTADOS (o repositório é público) que cobrem todas as coleções do
// app. Usados nos testes de ida e volta, no teste com Postgres e no
// verificar-v2. Nada aqui é de gente de verdade.
const doc = (col, id, data) => ({ col, id, data });
export const FOTO_A = "a".repeat(32), FOTO_B = "b".repeat(32), FOTO_C = "c".repeat(32), COMP = "d".repeat(32);
export const exemplo = [
  doc("comunidades", "c1", { nome: "Comunidade Azul", apelido: "Azul", goms: "Gabi e Duda", situacao: "Ativa", pix: "chave-secreta", comprovante: "privado", obs: "grupo bom" }),
  doc("comunidades", "c2", { nome: "Outra", goms: "Ana" }),
  doc("gruposwa", "w1", { nome: "Grupo A", comunidade: "Azul", cat: "claim" }),
  doc("cegs", "g1", { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi", planilha: "https://exemplo/planilha", status: "Em andamento", conferidoEm: "2026-11-01" }),
  doc("cegs", "g2", { nome: "Variados", comunidade: "Comunidade Azul", gom: "Gabi" }),
  doc("cegs", "g3", { nome: "Variados", comunidade: "Outra", gom: "Ana" }),
  doc("itens", "i1", { item: "caixa 2 PHP", ceg: "Caixa 2 PHP", comunidade: "Azul", valor: "9,45", status: "Na WH / proxy", cards: ["karma-han-01", "karma-felix-01"], etiquetas: "troca, bias", prova: "msg da GOM", ord: 3 }),
  doc("itens", "i2", { item: "Han Aladin", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", status: "Recebido", cards: ["karma-han-01"] }),
  doc("itens", "i3", { item: "SG linguinha", ceg: "CEG sem cadastro", comunidade: "Comunidade Azul", status: "Garantido" }),
  doc("itens", "i4", { item: "Variados 26", ceg: "Variados", comunidade: "Outra", status: "Garantido", etiquetas: "troca, bias", travado: ["status"], obs: "veio amassado" }),
  doc("acervo", "a1", { nome: "Lightstick", tipo: "Merch", st: "caminho" }),
  doc("cobrancas", "k1", { referente: "frete inter", comunidade: "Azul", ceg: "Caixa 2 PHP", valor: 18.4, prazo: "2026-11-27", status: "Pendente", pix: "x", grupo: "Avisos", travado: ["valor"] }),
  doc("cobrancas", "k2", { referente: "taxa RF", comunidade: "Comunidade Azul", ceg: "Caixa 2 PHP", valor: "1.234,50", status: "Paga", pagoEm: "2026-11-02", comprovanteAsset: COMP, pagoProva: "comprovante PicPay", prova: "chat com a GOM", pagarComo: "x" }),
  doc("repasses", "r1", { item: "Felix repetido", pessoa: "Fulana", valor: "25", pago: "Sim", data: "2026-11-02" }),
  doc("envios", "e1", { gom: "Duda", comunidade: "Comunidade Azul", status: "Envio liberado", itens: "8 pcs", obs: "combinar" }),
  doc("caixa", "tg-1", { origem: "telegram", recebidoEm: "2026-11-27T10:00:00.000Z", estado: "lida", texto: "oi", fonte: "texto da mensagem", resumo: "um frete", ceg: { id: "g1", nome: "Caixa 2 PHP" }, totalDevido: 27.85, semValor: 0, candidatas: [{ id: "g1", nome: "Caixa 2 PHP" }], registros: [{ destino: "cobrancas", acao: "paga", alvo: "k1", estado: "pendente", referente: "frete" }] }),
  doc("quadros", "q1", { gom: "Gabi", com: "Comunidade Azul", rasc: { r1: { asset: FOTO_B, frame: "f", nome: "x", membro: "HAN", cardId: "karma-han-01", ts: 1 } }, notas: { n1: { t: "lembrar" } } }),
  doc("binder", "meta", { n: { "karma-han-01": 2 }, tr: ["karma-han-01"], g: [{ id: "m1", nome: "set completo" }] }),
  doc("colecao", "han", { s: { "karma-han-01": "tenho", "karma-han-02": "quero" } }),
  doc("cardsnovos", "n1", { m: "HAN", e: "Era Nova", v: "Versão", t: "POB" }),
  doc("fotos", "i3", { asset: FOTO_A }),
  doc("fotos", "karma-han-01", { asset: FOTO_C }),
  doc("fotos", "karma-han-02", { url: "https://exemplo/foto.jpg" }),
  doc("meta", "fontes", { bot: { em: "2026-11-01", nota: "1 sugestão" } }),
  doc("mural", "m1", { qualquer: "coisa" }),
];

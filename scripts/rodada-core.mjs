// Rodada assistida: o que a planilha da CEG diz hoje, sem gravar nada e sem pix.
// Puro (sem rede) pra testar com dados inventados; api/rodada.js só junta com a planilha.

// Linha que traz chave pix, CPF, e-mail ou telefone não sai do servidor.
const SENSIVEL = /\bpix\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|[\w.+-]+@[\w-]+\.[\w.-]+|\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export const limpar = (l) => (SENSIVEL.test(l) ? "(linha com dados de pagamento, omitida)" : String(l).replace(/\s+/g, " ").trim().slice(0, 240));

const numeros = (v) => { const n = Number(v); return Number.isFinite(n) ? [n.toFixed(2).replace(".", ","), n.toFixed(2)] : []; };

// abas: saída de linhasDela ([{aba, cabecalho, dela}]); cobs: cobranças em aberto da CEG [{id, valor}]
export function resumoPlanilha(abas, cobs = []) {
  const out = abas.slice(0, 6).map((a) => ({ aba: a.aba || "", cabecalho: limpar(a.cabecalho.split("\n")[0] || ""), linhas: a.dela.slice(0, 8).map(limpar), mais: Math.max(0, a.dela.length - 8) }));
  const todas = abas.flatMap((a) => a.dela).filter((l) => !SENSIVEL.test(l));
  const cobrancas = cobs.map((c) => ({ id: c.id, achou: typeof c.valor === "number" ? numeros(c.valor).some((n) => todas.some((l) => l.includes(n))) : null }));
  return { achouNome: abas.length > 0, abas: out, cobrancas };
}

// Paboracha: cobranças da CEG vindas da API pública, no mesmo formato das abas da planilha.
const dataBR = (utc) => (utc ? new Date(new Date(utc).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10) : "");
const ST = { Pending: "a pagar", Overdue: "ATRASADA", Paid: "paga", Cancelled: "cancelada", Canceled: "cancelada" };
export function abasPabo(charges, cegNome) {
  const n = String(cegNome || "").trim().toLowerCase();
  const doCeg = charges.filter((c) => { const l = String((c.origin || {}).cegName || "").trim().toLowerCase(); return l && n && (l === n || l.includes(n) || n.includes(l)); });
  if (!doCeg.length) return [];
  const v = (x) => Number(x).toFixed(2).replace(".", ",");
  return [{ aba: "Paboracha", cabecalho: "cobrança · valor · prazo · situação", dela: doCeg.map((c) => `${c.description || "cobrança"};R$ ${v(c.currentAmount)};${dataBR(c.dueAtUtc).split("-").reverse().slice(0, 2).join("/") || "sem prazo"};${ST[c.status] || c.status || ""}`) }];
}
export const ehForms = (link) => /docs\.google\.com\/forms|forms\.gle|forms\.office|typeform\.com/i.test(link);

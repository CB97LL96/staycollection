// Aceitar sugestões da caixa fora do app (pelos botões do Telegram).
// Faz o mesmo que o "aceitar" da aba de sugestões do app (index.html,
// caixaAcao), gravando na tabela docs, sem campos de pix.
import { randomBytes } from "node:crypto";

const hoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const id10 = () => randomBytes(5).toString("hex"); // mesmo tamanho do app (hex(10))

export function registroParaDoc(r, caixa) {
  const base = {
    comunidade: r.comunidade || "", ceg: r.ceg || "",
    obs: [r.obs, r.duvidas && "conferir: " + r.duvidas].filter(Boolean).join("\n"),
    prova: "Telegram " + String(caixa.recebidoEm || "").slice(0, 10) + (r.trecho ? ": “" + r.trecho + "”" : ""),
  };
  const valor = typeof r.valor === "number" ? r.valor : null;
  if (r.destino === "itens") return { ...base, item: r.referente || "", membro: r.membro || "", valor, status: r.status || "A confirmar" };
  if (r.destino === "envios") return { ...base, gom: "", status: "A confirmar", prazo: r.prazo || "", itens: r.referente || "" };
  if (r.destino === "repasses") return { ...base, item: r.referente || "", valor, pago: "A confirmar" };
  return { ...base, referente: r.referente || "", tipo: r.tipo || "", valor, prazo: r.prazo || "", status: r.confianca === "alta" ? "Pendente" : "A confirmar", aviso: String(caixa.recebidoEm || "").slice(0, 10) };
}

// patch de uma mudança em registro que já existe
export function patchDe(r) {
  const h = hoje();
  if (r.acao === "paga") return { status: "Paga", pagoEm: r.pagoEm || h, conferidoEm: h };
  if (r.acao === "cancelada") return { status: "Cancelada", conferidoEm: h };
  if (r.acao === "valor") return { valor: r.valor, conferidoEm: h };
  if (r.acao === "prazo") return { prazo: r.prazo, conferidoEm: h };
  if (r.acao === "status") return { status: r.status };
  return null;
}

// rest(path, opts) já autenticado; devolve quantas foram gravadas
export async function aceitarTodas(rest, owner, caixaId) {
  const [cx] = await rest(`docs?owner=eq.${owner}&col=eq.caixa&id=eq.${encodeURIComponent(caixaId)}&select=data`);
  if (!cx) return { ok: 0, falhas: 0, sumiu: true };
  const c = cx.data, regs = (c.registros || []).map((r) => ({ ...r }));
  let ok = 0, falhas = 0;
  for (const r of regs) {
    if (r.estado !== "pendente") continue;
    try {
      if (r.acao && r.acao !== "nova") {
        const col = r.acao === "status" ? "itens" : "cobrancas";
        const filtro = `docs?owner=eq.${owner}&col=eq.${col}&id=eq.${encodeURIComponent(r.alvo)}`;
        const [atual] = await rest(`${filtro}&select=data`);
        if (!atual) { falhas++; continue; }
        await rest(filtro, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...atual.data, ...patchDe(r) } }) });
      } else {
        const col = ["cobrancas", "itens", "envios", "repasses"].includes(r.destino) ? r.destino : "cobrancas";
        const novo = r.novo ? { ...r.novo, aviso: hoje(), conferidoEm: hoje() } : registroParaDoc(r, c);
        await rest("docs", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner, col, id: id10(), data: novo }) });
      }
      r.estado = "aceito"; ok++;
    } catch (e) { falhas++; }
  }
  await rest(`docs?owner=eq.${owner}&col=eq.caixa&id=eq.${encodeURIComponent(caixaId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...c, registros: regs } }) });
  return { ok, falhas };
}

export async function descartarTodas(rest, owner, caixaId) {
  const [cx] = await rest(`docs?owner=eq.${owner}&col=eq.caixa&id=eq.${encodeURIComponent(caixaId)}&select=data`);
  if (!cx) return 0;
  const regs = (cx.data.registros || []).map((r) => (r.estado === "pendente" ? { ...r, estado: "descartado" } : r));
  await rest(`docs?owner=eq.${owner}&col=eq.caixa&id=eq.${encodeURIComponent(caixaId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...cx.data, registros: regs } }) });
  return regs.length;
}

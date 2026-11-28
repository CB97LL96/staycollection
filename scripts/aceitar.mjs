// Aceitar sugestões da caixa fora do app (pelos botões do Telegram).
// Faz o mesmo que o "aceitar" da aba de sugestões do app (index.html,
// caixaAcao), gravando no modelo de dados escolhido (DATA_MODEL: docs ou v2), sem campos de pix.
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

// "s" é o store (scripts/v2/store.mjs): lê e grava no modelo certo (docs ou v2).
// Devolve quantas foram gravadas. O robô nunca muda um campo que ela travou: nesse caso o
// registro conta como falha e fica na aba de sugestões pra ela decidir.
export async function aceitarTodas(s, caixaId) {
  const c = await s.pegar("caixa", caixaId);
  if (!c) return { ok: 0, falhas: 0, sumiu: true };
  const regs = (c.registros || []).map((r) => ({ ...r }));
  let ok = 0, falhas = 0;
  for (const r of regs) {
    if (r.estado !== "pendente") continue;
    try {
      if (r.acao && r.acao !== "nova") {
        const col = r.acao === "status" ? "itens" : "cobrancas";
        const res = await s.mesclar(col, r.alvo, patchDe(r), { robo: true });
        if (!res.ok || res.ignorados.length) { falhas++; continue; }
      } else {
        const col = ["cobrancas", "itens", "envios", "repasses"].includes(r.destino) ? r.destino : "cobrancas";
        const novo = r.novo ? { ...r.novo, aviso: hoje(), conferidoEm: hoje() } : registroParaDoc(r, c);
        await s.criar(col, novo, id10());
      }
      r.estado = "aceito"; ok++;
    } catch (e) { falhas++; }
  }
  await s.gravar("caixa", caixaId, { ...c, registros: regs });
  return { ok, falhas };
}

export async function descartarTodas(s, caixaId) {
  const c = await s.pegar("caixa", caixaId);
  if (!c) return 0;
  const regs = (c.registros || []).map((r) => (r.estado === "pendente" ? { ...r, estado: "descartado" } : r));
  await s.gravar("caixa", caixaId, { ...c, registros: regs });
  return regs.length;
}

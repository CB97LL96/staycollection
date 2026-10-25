// Confere todo dia as cobranças do paboracha com as do app.
//
// O paboracha tem uma API pública (sem login) com as cobranças de cada perfil.
// Esta conferência não usa o Claude: lê os números direto de lá.
//
// O que faz:
//   - cobrança do app ligada a uma do paboracha (campo paboId) e tudo igual
//       -> grava conferidoEm = hoje (o app mostra "conferido hoje")
//   - qualquer diferença (pagou lá, valor mudou, prazo mudou, cobrança nova)
//       -> deixa uma SUGESTÃO na caixa de entrada (aba "O que devo"), pra ela
//          aceitar ou descartar. Nunca muda valor, prazo nem status sozinha.
// Cada sugestão tem um id fixo (pabo-<cobrança>-<o que mudou>), então uma
// sugestão descartada não volta no dia seguinte.
//
// Variáveis de ambiente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID
//   PABORACHA_PERFIL  o fim do link do seu perfil na API (ex.: fulana-2)

const API = "https://paboracha.com.br/api/v1/profiles";
const ABERTAS = ["Pendente", "A confirmar", "Aguardando a GOM", "Não liberado"];
const ABERTA_LA = ["Pending", "Overdue"];

const brl = (n) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
const fd = (iso) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "sem prazo");
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
// "2026-10-25T03:00:00+00:00" é meia-noite de 25/10 no horário de Brasília.
const dataBR = (utc) => (utc ? new Date(new Date(utc).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10) : "");
const centavos = (n) => Math.round(Number(n) * 100);

export async function baixarCobrancasPabo(perfil) {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${API}/${encodeURIComponent(perfil)}/charges?page=${page}&pageSize=20`, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`paboracha: HTTP ${r.status}`);
    const j = await r.json();
    out.push(...(j.items || []));
    if (page >= (j.totalPages || 1)) break;
  }
  return out;
}

const TIPO = { Item: "Item", Fee: "Armazenamento", InternationalFreight: "Frete internacional", NationalFreight: "Frete nacional" };

// Como a cobrança do paboracha vira uma cobrança do app.
export function paraCobranca(c, { comunidade, cegs }) {
  const o = c.origin || {};
  const membro = (c.lines || []).find((l) => l.type === "Principal")?.description || String(c.description || "").replace(/^Item:\s*/, "");
  const referente = c.type === "Item"
    ? [o.subcategoryName, o.setNumber != null && `Set ${o.setNumber}`, membro].filter(Boolean).join(" · ")
    : c.type === "Fee" && (c.lines || []).length > 1
      ? `${c.description} (${c.lines.length} itens)`
      : c.description || "";
  const cegLa = String(o.cegName || "").trim();
  const ceg = cegs.find((n) => n.toLowerCase() === cegLa.toLowerCase()) || cegs.find((n) => cegLa && n.toLowerCase().includes(cegLa.toLowerCase())) || cegLa;
  const tipo = TIPO[c.type] || (c.type === "Fee" ? "Outro" : "Outro");
  const detalhe = c.type !== "Item" && (c.lines || []).length > 1 ? c.lines.map((l) => `${l.description}: ${brl(l.amount)}`).join("\n") : "";
  return {
    comunidade, ceg, referente, tipo: c.description === "Taxas de armazenamento" ? "Armazenamento" : tipo,
    valor: Number(c.currentAmount), prazo: dataBR(c.dueAtUtc),
    status: o.isPaymentReleased === false ? "Não liberado" : "Pendente",
    pagarComo: "No site do paboracha", pagarLink: "https://paboracha.com.br",
    prova: `Paboracha: ${c.description}${c.lateFeeAmount ? ` (inclui multa de ${brl(c.lateFeeAmount)})` : ""}`,
    paboId: c.id,
    obs: detalhe,
  };
}

async function rest(url, key, path, opts = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase: HTTP ${r.status} ${await r.text()}`);
  return r.status === 201 || r.status === 204 ? null : r.json();
}

// Compara e devolve { sugestoes: [{id, registro}], conferidas: [docId] }.
// Separado do resto pra dar pra testar sem rede.
export function comparar(pabo, docs, { comunidade, cegs }) {
  const cobs = docs.filter((d) => d.col === "cobrancas");
  const porPabo = new Map(cobs.filter((d) => d.data.paboId).map((d) => [d.data.paboId, d]));
  const usadas = new Set();
  const sugestoes = [], conferidas = [];
  const sug = (id, registro) => sugestoes.push({ id, registro: { confianca: "alta", estado: "pendente", ...registro } });

  for (const c of pabo) {
    const nova = paraCobranca(c, { comunidade, cegs });
    const aberta = ABERTA_LA.includes(c.status);
    const ligada = porPabo.get(c.id);
    const titulo = nova.referente || c.description;
    const base = { destino: "cobrancas", referente: titulo, comunidade: nova.comunidade, ceg: nova.ceg, valor: nova.valor, prazo: nova.prazo };

    if (ligada) {
      usadas.add(ligada.id);
      const a = ligada.data;
      if (!ABERTAS.includes(a.status)) continue; // no app já está paga/cancelada
      if (c.status === "Paid") { sug(`pabo-${c.id}-paga`, { ...base, acao: "paga", alvo: ligada.id, pagoEm: dataBR(c.paidAtUtc), trecho: `No paboracha: paga em ${fd(dataBR(c.paidAtUtc))}` }); continue; }
      if (c.status === "Cancelled" || c.status === "Canceled") { sug(`pabo-${c.id}-cancelada`, { ...base, acao: "cancelada", alvo: ligada.id, trecho: "No paboracha: cancelada" }); continue; }
      let igual = true;
      if (centavos(a.valor) !== centavos(nova.valor)) {
        igual = false;
        sug(`pabo-${c.id}-valor-${centavos(nova.valor)}`, { ...base, acao: "valor", alvo: ligada.id, trecho: `No paboracha o valor agora é ${brl(nova.valor)} (no app: ${typeof a.valor === "number" ? brl(a.valor) : "sem valor"})${c.lateFeeAmount ? `, com multa de ${brl(c.lateFeeAmount)}` : ""}` });
      }
      if (nova.prazo && (a.prazo || "") !== nova.prazo) {
        igual = false;
        sug(`pabo-${c.id}-prazo-${nova.prazo}`, { ...base, acao: "prazo", alvo: ligada.id, trecho: `No paboracha o prazo é ${fd(nova.prazo)} (no app: ${fd(a.prazo)})` });
      }
      if (igual) conferidas.push(ligada.id);
      continue;
    }

    if (!aberta) continue; // histórico já pago que nunca foi anotado: ignora

    // Cobrança aberta lá e sem ligação no app. Se existir no app uma cobrança
    // aberta do paboracha, sem ligação, com o mesmo valor e o mesmo membro/CEG,
    // sugere ligar as duas em vez de criar repetida.
    const parecidas = cobs.filter((d) => !d.data.paboId && !usadas.has(d.id) && ABERTAS.includes(d.data.status)
      && /pabo/i.test(`${d.data.comunidade} ${d.data.prova || ""}`)
      && centavos(d.data.valor) === centavos(nova.valor)
      && (() => { const txt = `${d.data.referente} ${d.data.ceg}`.toLowerCase(); return titulo.toLowerCase().split(" · ").some((p) => p.length > 2 && txt.includes(p.toLowerCase())); })());
    if (parecidas.length === 1) {
      usadas.add(parecidas[0].id);
      sug(`pabo-${c.id}-ligar`, { ...base, acao: "ligar", alvo: parecidas[0].id, alvoTitulo: parecidas[0].data.referente || "", novo: nova, trecho: `Parece ser a mesma que “${parecidas[0].data.referente}” do app. Aceitar liga as duas (e acerta prazo e valor pelo paboracha).` });
    } else {
      sug(`pabo-${c.id}-nova`, { ...base, acao: "nova", novo: nova, trecho: `No paboracha: ${c.description}, ${brl(nova.valor)}, ${c.status === "Overdue" ? "ATRASADA" : "vence " + fd(nova.prazo)}`, ...(parecidas.length > 1 ? { duvidas: `há ${parecidas.length} cobranças parecidas no app; confira se não é repetida` } : {}) });
    }
  }
  return { sugestoes, conferidas };
}

export async function conferirPaboracha(url, key, ownerId, { perfil, hoje = hojeBR() } = {}) {
  if (!ownerId) throw new Error("Falta OWNER_ID.");
  if (!perfil) throw new Error("Falta PABORACHA_PERFIL.");
  const [pabo, docs] = await Promise.all([
    baixarCobrancasPabo(perfil),
    rest(url, key, `docs?owner=eq.${ownerId}&col=in.(cobrancas,cegs,comunidades,caixa)&select=col,id,data&limit=10000`),
  ]);
  const comunidade = docs.filter((d) => d.col === "comunidades").map((d) => d.data.nome).find((n) => /pabo/i.test(n || "")) || "Paboracha";
  const cegs = docs.filter((d) => d.col === "cegs" && (d.data.comunidade || "") === comunidade).map((d) => d.data.nome).filter(Boolean);
  const { sugestoes, conferidas } = comparar(pabo, docs, { comunidade, cegs });

  const jaNaCaixa = new Set(docs.filter((d) => d.col === "caixa").map((d) => d.id));
  const novas = sugestoes.filter((s) => !jaNaCaixa.has(s.id));
  if (novas.length) {
    const agora = new Date().toISOString();
    await rest(url, key, "docs?on_conflict=owner,col,id", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(novas.map((s) => ({
        owner: ownerId, col: "caixa", id: s.id,
        data: { origem: "paboracha", recebidoEm: agora, estado: "lida", resumo: s.registro.trecho, registros: [s.registro] },
      }))),
    });
  }
  // Só o campo da conferência, relendo antes pra não apagar edição dela.
  for (const id of conferidas) {
    const filtro = `docs?owner=eq.${ownerId}&col=eq.cobrancas&id=eq.${encodeURIComponent(id)}`;
    const [atual] = await rest(url, key, `${filtro}&select=data`);
    if (!atual || !ABERTAS.includes(atual.data.status) || atual.data.conferidoEm === hoje) continue;
    await rest(url, key, filtro, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...atual.data, conferidoEm: hoje } }) });
  }
  const abertasLa = pabo.filter((c) => ABERTA_LA.includes(c.status));
  return {
    abertasNoPaboracha: abertasLa.length,
    totalAberto: Number(abertasLa.reduce((s, c) => s + Number(c.currentAmount), 0).toFixed(2)),
    conferidas: conferidas.length, sugestoesNovas: novas.length,
  };
}

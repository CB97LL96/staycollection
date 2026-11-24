// Leva os registros do app atual (tabela "docs", um JSON por registro) para
// as tabelas do modelo novo (supabase/v2.sql). Função pura: recebe os docs e
// devolve as linhas de cada tabela e um relatório. Quem lê e grava no
// Supabase é o scripts/migrar-v2.mjs.
//
// Regras:
// * ids previsíveis (prefixo + id antigo), então rodar de novo não duplica;
// * ligações por id: nomes de comunidade/CEG/GOM viram ids aqui;
// * nome citado que não existe como registro vira registro novo, e o
//   relatório diz quais foram;
// * pix e caminho de comprovante não vêm para o modelo novo (ficam só no
//   app antigo, que não é apagado);
// * um item antigo com vários cards vira uma claim (a linha como estava) e
//   um item por card.
import { createHash } from "node:crypto";

export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const curto = (s) => createHash("sha1").update(String(s)).digest("hex").slice(0, 10);
const txt = (v) => { const s = String(v ?? "").trim(); return s || null; };
const data = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// "9,45" -> 9.45; "1.234,50" -> 1234.5; "R$ 12" -> 12; 12 -> 12; "" -> null.
export function valor(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/r\$|\s/gi, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Campos de dinheiro que o app novo não guarda (decisão da usuária).
const SEM_PIX = /^(pix|pagarComo|pagarLink|pagarNota|compOnde|compLink|comprovante)$/;
const legado = (d) => Object.fromEntries(Object.entries(d || {}).filter(([k]) => !SEM_PIX.test(k)));

// "Gabi e Duda", "Gabi, Duda", "Gabi / Duda" -> ["Gabi", "Duda"]
export const separarGoms = (s) => String(s ?? "").split(/\s*(?:,|;|\/|\+|&|\be\b)\s*/i).map((x) => x.trim()).filter(Boolean);

export function mapear(docs, { cardIds = new Set() } = {}) {
  const by = (col) => docs.filter((d) => d.col === col);
  const t = { comunidades: [], goms: [], grupos_wa: [], cegs: [], claims: [], itens: [], cobrancas: [], envios: [], provas: [], card_fotos: [] };
  const rel = { criadas: { comunidades: [], cegs: [], goms: [] }, cegAmbigua: [], semPix: 0, itensSemCard: 0, repetidos: 0, fora: { caixa: 0, meta: 0, outros: 0 }, valoresEstranhos: [] };

  // fotos enviadas: {chave: {asset}}
  const fotos = new Map(by("fotos").map((d) => [d.id, d.data && d.data.asset]).filter(([, a]) => /^[0-9a-f]{32}$/.test(a || "")));
  const contaPix = (d) => { if (Object.keys(d || {}).some((k) => SEM_PIX.test(k) && txt(d[k]))) rel.semPix++; };

  // ---------- comunidades ----------
  const comPorNome = new Map();
  for (const d of by("comunidades")) {
    const x = d.data || {}; if (!txt(x.nome)) continue;
    contaPix(x);
    const row = { id: `com-${d.id}`, nome: x.nome.trim(), apelido: txt(x.apelido), situacao: txt(x.situacao), onde_olhar: null, sigla: txt(x.sigla), cor: txt(x.cor), notas: txt(x.obs), legado: legado(x) };
    t.comunidades.push(row); comPorNome.set(norm(row.nome), row.id);
    if (row.apelido) comPorNome.set(norm(row.apelido), row.id);
  }
  const comunidade = (nome) => {
    const k = norm(nome); if (!k) return null;
    if (comPorNome.has(k)) return comPorNome.get(k);
    const id = `com-x-${curto(k)}`;
    t.comunidades.push({ id, nome: String(nome).trim(), legado: null }); comPorNome.set(k, id); rel.criadas.comunidades.push(String(nome).trim());
    return id;
  };

  // ---------- GOMs: da comunidade, das CEGs e dos envios ----------
  const gomPorChave = new Map();
  const gom = (nome, comId, criadaPorRef = true) => {
    const k = norm(nome); if (!k) return null;
    const chave = `${comId || ""}|${k}`;
    if (gomPorChave.has(chave)) return gomPorChave.get(chave);
    const id = `gom-${curto(chave)}`;
    t.goms.push({ id, comunidade_id: comId, nome: String(nome).trim() }); gomPorChave.set(chave, id);
    if (criadaPorRef) rel.criadas.goms.push(String(nome).trim());
    return id;
  };
  for (const d of by("comunidades")) for (const g of separarGoms(d.data && d.data.goms)) gom(g, comPorNome.get(norm(d.data.nome)), false);

  // ---------- grupos do WhatsApp ----------
  for (const d of by("gruposwa")) {
    const x = d.data || {}; if (!txt(x.nome)) continue;
    t.grupos_wa.push({ id: `grp-${d.id}`, comunidade_id: comunidade(x.comunidade), nome: x.nome.trim(), cat: txt(x.cat), arquivado: !!x.arquivado, legado: legado(x) });
  }

  // ---------- CEGs ----------
  const cegPorChave = new Map(), cegPorNome = new Map();
  const guardaCeg = (row, comId) => {
    cegPorChave.set(`${comId || ""}|${norm(row.nome)}`, row.id);
    const k = norm(row.nome); cegPorNome.set(k, cegPorNome.has(k) ? "ambigua" : row.id);
  };
  for (const d of by("cegs")) {
    const x = d.data || {}; if (!txt(x.nome)) continue;
    const comId = comunidade(x.comunidade);
    const row = { id: `ceg-${d.id}`, comunidade_id: comId, gom_id: x.gom ? gom(x.gom, comId) : null, nome: x.nome.trim(), grupo_wa: txt(x.grupo), planilha: txt(x.planilha), forms: null, origem: txt(x.origem), status: txt(x.status), notas: txt(x.obs), legado: legado(x) };
    t.cegs.push(row); guardaCeg(row, comId);
  }
  const ceg = (nome, comNome) => {
    const k = norm(nome); if (!k) return null;
    const comId = comNome ? comunidade(comNome) : null;
    const exata = cegPorChave.get(`${comId || ""}|${k}`); if (exata) return exata;
    const soNome = cegPorNome.get(k);
    if (soNome && soNome !== "ambigua") {
      // sem comunidade citada, ou a CEG existente não tem comunidade: é ela
      const existente = t.cegs.find((c) => c.id === soNome);
      if (!comNome || !existente.comunidade_id) return soNome;
    }
    if (soNome === "ambigua" && !comNome) rel.cegAmbigua.push(String(nome).trim());
    const id = `ceg-x-${curto(`${comId || ""}|${k}`)}`;
    const row = { id, comunidade_id: comId, gom_id: null, nome: String(nome).trim(), legado: null };
    t.cegs.push(row); guardaCeg(row, comId); rel.criadas.cegs.push(`${String(nome).trim()}${comNome ? ` (${comNome})` : ""}`);
    return id;
  };

  const prova = (alvo, alvoId, x) => {
    if (!txt(x.prova) && !txt(x.provaLink)) return;
    t.provas.push({ id: `prova-${alvo}-${alvoId}`, tipo: txt(x.provaLink) ? "link" : "mensagem", texto: txt(x.prova), link: txt(x.provaLink), alvo, alvo_id: alvoId });
  };
  const valorDe = (v, onde) => { const n = valor(v); if (v != null && v !== "" && n == null) rel.valoresEstranhos.push(`${onde}: ${v}`); return n; };

  // ---------- itens antigos -> claim + item(s) ----------
  for (const d of by("itens")) {
    const x = d.data || {};
    const cegId = x.ceg ? ceg(x.ceg, x.comunidade) : null;
    const claimId = `claim-${d.id}`;
    t.claims.push({ id: claimId, ceg_id: cegId, texto: txt(x.item) || "(sem nome)", valor: valorDe(x.valor, `item ${d.id}`), notas: txt(x.obs), legado: legado(x) });
    prova("claims", claimId, x);
    const cards = Array.isArray(x.cards) ? x.cards.filter(Boolean) : [];
    const foto = fotos.get(d.id) || fotos.get(`item-${d.id}`) || null;
    const etiquetas = String(x.etiquetas || "").split(",").map((e) => e.trim()).filter(Boolean);
    const base = { membro: txt(x.membro), tipo: txt(x.tipo), claim_id: claimId, ceg_id: cegId, origem: x.ceg ? "ceg" : "compra", status: txt(x.status), foto, etiquetas, travado: Array.isArray(x.travado) ? x.travado : [], notas: txt(x.obs) };
    if (!cards.length) { rel.itensSemCard++; t.itens.push({ id: `item-${d.id}`, card_id: null, descricao: txt(x.item), ...base }); }
    cards.forEach((c, i) => t.itens.push({ id: cards.length === 1 ? `item-${d.id}` : `item-${d.id}-${i + 1}`, card_id: c, descricao: cards.length === 1 ? txt(x.item) : null, ...base, foto: cards.length === 1 ? foto : null }));
  }
  // acervo: itens que já estavam com você, sem pedido
  for (const d of by("acervo")) {
    const x = d.data || {};
    t.itens.push({ id: `acervo-${d.id}`, card_id: null, descricao: txt(x.nome), membro: txt(x.membro), tipo: txt(x.tipo) || "Merch", era: txt(x.era), origem: "acervo", status: x.st === "caminho" ? "Enviado" : "Recebido", foto: fotos.get(`acervo-${d.id}`) || null, legado: legado(x) });
  }

  // repetidos: mais de uma cópia ativa do mesmo card
  const FORA = new Set(["Set não fechou", "Claim perdida", "Repassei", "Abandonado", "Cancelado"]);
  const porCard = new Map();
  for (const it of t.itens) if (it.card_id && !FORA.has(it.status)) porCard.set(it.card_id, (porCard.get(it.card_id) || 0) + 1);
  rel.repetidos = [...porCard.values()].filter((n) => n > 1).length;

  // ---------- cobranças (a pagar) e repasses (a receber) ----------
  for (const d of by("cobrancas")) {
    const x = d.data || {}; contaPix(x);
    const id = `cob-${d.id}`;
    t.cobrancas.push({ id, direcao: "pagar", comunidade_id: comunidade(x.comunidade), ceg_id: x.ceg ? ceg(x.ceg, x.comunidade) : null, referente: txt(x.referente), tipo: txt(x.tipo), valor: valorDe(x.valor, `cobrança ${d.id}`), prazo: data(x.prazo), prazo_nota: txt(x.prazoNota), status: txt(x.status), onde_olhar: txt(x.grupo), aviso_em: data(x.aviso), pago_em: data(x.pagoEm), conferido_em: data(x.conferidoEm), pabo_id: txt(x.paboId), notas: txt(x.obs), legado: legado(x) });
    prova("cobrancas", id, x);
  }
  for (const d of by("repasses")) {
    const x = d.data || {};
    const id = `rep-${d.id}`;
    t.cobrancas.push({ id, direcao: "receber", comunidade_id: comunidade(x.comunidade), ceg_id: x.ceg ? ceg(x.ceg, x.comunidade) : null, pessoa: txt(x.pessoa), referente: txt(x.item), tipo: "Repasse", valor: valorDe(x.valor, `repasse ${d.id}`), status: x.pago === true || norm(x.pago) === "sim" ? "Paga" : "Pendente", aviso_em: data(x.data), onde_olhar: txt(x.grupo), notas: txt(x.obs), legado: legado(x) });
    prova("cobrancas", id, x);
  }

  // ---------- envios ----------
  for (const d of by("envios")) {
    const x = d.data || {};
    const comId = comunidade(x.comunidade);
    const id = `env-${d.id}`;
    t.envios.push({ id, comunidade_id: comId, gom_id: x.gom ? gom(x.gom, comId) : null, tipo: txt(x.tipo), status: txt(x.status), prazo: data(x.prazo), prazo_nota: txt(x.prazoNota), rastreio: txt(x.rastreio), como_pedir: txt(x.comoPedir), onde_olhar: txt(x.grupo), notas: [txt(x.itens) && `itens: ${x.itens}`, txt(x.obs)].filter(Boolean).join("\n") || null, legado: legado(x) });
    prova("envios", id, x);
  }

  // ---------- foto escolhida pra card do catálogo ----------
  for (const [k, a] of fotos) if (cardIds.has(k)) t.card_fotos.push({ card_id: k, foto: a });

  // o que fica só no app antigo
  const conhecidas = new Set(["comunidades", "gruposwa", "cegs", "itens", "acervo", "cobrancas", "repasses", "envios", "fotos"]);
  for (const d of docs) if (!conhecidas.has(d.col)) rel.fora[d.col in rel.fora ? d.col : "outros"]++;

  rel.contagem = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.length]));
  return { tabelas: t, relatorio: rel };
}

// ordem de gravação (quem é referenciado vem antes)
export const ORDEM = ["comunidades", "goms", "grupos_wa", "cegs", "claims", "itens", "cobrancas", "envios", "provas", "card_fotos"];

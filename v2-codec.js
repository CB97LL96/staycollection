// Tradução entre o formato "documento" que o app sempre usou (coleção + id +
// JSON) e as tabelas do modelo novo (supabase/v2.sql). Um arquivo só, sem
// import/export, pra rodar igual no navegador (backend.js) e no servidor
// (scripts/v2/*.mjs, api/*): no navegador vira window.StayV2, no Node vira
// globalThis.StayV2.
//
// Regras:
//  * ids: o id da tabela nova é prefixo + id antigo (ex.: "ceg-ab12"), então o
//    id que o app e os botões do Telegram usam não muda;
//  * ligações por id: nomes de comunidade/GOM/CEG viram ids aqui, e voltam
//    como nome na hora de montar o documento (renomear não quebra nada);
//  * cada linha guarda em "legado" o documento inteiro (menos pix e caminho
//    de comprovante); o documento de volta é "legado" + as colunas, e a
//    coluna manda quando tem valor. Nada se perde;
//  * "claim" é a linha como a GOM escreveu: o documento "itens" do app é a
//    claim com a lista "cards" dos itens (as cópias dela) ligados a ela;
//  * pix e caminho de comprovante nunca entram no modelo novo.
(function (g) {
"use strict";

// ---------- utilidades ----------
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
// hash curto sem crypto, igual no navegador e no Node (ids dos registros criados por citação)
function curto(s) {
  s = String(s); let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b + c, 2246822519) >>> 0; b ^= b >>> 13; }
  return (a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0")).slice(0, 10);
}
const txt = (v) => { const s = String(v ?? "").trim(); return s || null; };
const data = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
function valor(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/r\$|\s/gi, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const SEM_PIX = /^(pix|pagarComo|pagarLink|pagarNota|compOnde|compLink|comprovante)$/;
const semPix = (d) => Object.fromEntries(Object.entries(d || {}).filter(([k]) => !SEM_PIX.test(k)));
const separarGoms = (s) => String(s ?? "").split(/\s*(?:,|;|\/|\+|&|\be\b)\s*/i).map((x) => x.trim()).filter(Boolean);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const arr = (v) => (Array.isArray(v) ? v : []);
const hojeISO = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

// ---------- o que existe ----------
const TABELAS = ["comunidades", "goms", "grupos_wa", "cegs", "claims", "itens", "item_status", "cobrancas", "cobranca_itens", "envios", "envio_itens", "provas", "apelidos", "card_fotos", "sugestoes", "quadros", "binder_meta", "posse", "cards_novos", "meta", "avulsos"];
// ordem de gravação (quem é referenciado vem antes); apagar usa a ordem inversa
const ORDEM = ["comunidades", "goms", "grupos_wa", "cegs", "claims", "itens", "item_status", "cobrancas", "envios", "provas", "sugestoes", "quadros", "binder_meta", "posse", "card_fotos", "cards_novos", "meta", "avulsos"];
// chave primária de cada tabela (sem o dono)
const PK = { binder_meta: [], posse: ["card_id"], card_fotos: ["card_id"], meta: ["chave"], avulsos: ["col", "id"] };
const pkDe = (tab) => PK[tab] || ["id"];
const pkVal = (tab, row) => pkDe(tab).map((k) => row[k]).join("\u0001") || "_";
// coleção do app -> tabelas que ela lê (pra recalcular só o que mudou)
const DEPENDE = {
  comunidades: ["comunidades", "goms"], gruposwa: ["grupos_wa", "comunidades"], cegs: ["cegs", "comunidades", "goms"],
  itens: ["claims", "itens", "cegs", "comunidades", "provas"], acervo: ["itens"],
  cobrancas: ["cobrancas", "comunidades", "cegs", "provas"], repasses: ["cobrancas", "comunidades", "cegs", "provas"],
  envios: ["envios", "comunidades", "goms", "provas"], caixa: ["sugestoes", "cegs"], quadros: ["quadros", "comunidades", "goms"],
  binder: ["binder_meta", "avulsos"], colecao: ["posse"], cardsnovos: ["cards_novos"], fotos: ["card_fotos"], meta: ["meta"],
};
const COLS_DOCS = Object.keys(DEPENDE);
const tabelasDe = (col) => (DEPENDE[col] || ["avulsos"]);

const vazias = () => Object.fromEntries(TABELAS.map((t) => [t, []]));
const mapas = (T) => { const o = {}; for (const t of TABELAS) { const v = T && T[t]; o[t] = v instanceof Map ? v : new Map(arr(v).map((r) => [pkVal(t, r), r])); } return o; };

// ---------- documento -> linhas ----------
function novoMapeador(T0, op = {}) {
  const T = mapas(T0);
  const hoje = op.hoje || hojeISO();
  const t = vazias();
  const del = Object.fromEntries(TABELAS.map((x) => [x, []]));
  const rel = { criadas: { comunidades: [], cegs: [], goms: [] }, cegAmbigua: [], semPix: 0, itensSemCard: 0, valoresEstranhos: [] };
  const contaPix = (d) => { if (Object.keys(d || {}).some((k) => SEM_PIX.test(k) && txt(d[k]))) rel.semPix++; };
  const valorDe = (v, onde) => { const n = valor(v); if (v != null && v !== "" && n == null) rel.valoresEstranhos.push(`${onde}: ${v}`); return n; };

  // ---- comunidades ----
  const comPorNome = new Map();
  for (const r of T.comunidades.values()) { comPorNome.set(norm(r.nome), r.id); if (r.apelido) comPorNome.set(norm(r.apelido), r.id); }
  const comunidade = (nome) => {
    const k = norm(nome); if (!k) return null;
    if (comPorNome.has(k)) return comPorNome.get(k);
    const id = `com-x-${curto(k)}`;
    t.comunidades.push({ id, nome: String(nome).trim(), legado: null }); comPorNome.set(k, id); rel.criadas.comunidades.push(String(nome).trim());
    return id;
  };
  // ---- GOMs ----
  const gomPorChave = new Map();
  for (const r of T.goms.values()) gomPorChave.set(`${r.comunidade_id || ""}|${norm(r.nome)}`, r.id);
  const gom = (nome, comId, criadaPorRef = true) => {
    const k = norm(nome); if (!k) return null;
    const chave = `${comId || ""}|${k}`;
    if (gomPorChave.has(chave)) return gomPorChave.get(chave);
    const id = `gom-${curto(chave)}`;
    t.goms.push({ id, comunidade_id: comId, nome: String(nome).trim() }); gomPorChave.set(chave, id);
    if (criadaPorRef) rel.criadas.goms.push(String(nome).trim());
    return id;
  };
  // ---- CEGs ----
  const cegPorChave = new Map(), cegPorNome = new Map(), cegsNovas = new Map();
  const guardaCeg = (row) => {
    cegPorChave.set(`${row.comunidade_id || ""}|${norm(row.nome)}`, row.id);
    const k = norm(row.nome); cegPorNome.set(k, cegPorNome.has(k) && cegPorNome.get(k) !== row.id ? "ambigua" : row.id);
  };
  for (const r of T.cegs.values()) guardaCeg(r);
  const ceg = (nome, comNome) => {
    const k = norm(nome); if (!k) return null;
    const comId = comNome ? comunidade(comNome) : null;
    const exata = cegPorChave.get(`${comId || ""}|${k}`); if (exata) return exata;
    const soNome = cegPorNome.get(k);
    if (soNome && soNome !== "ambigua") {
      const existente = T.cegs.get(soNome) || cegsNovas.get(soNome);
      if (!comNome || !existente || !existente.comunidade_id) return soNome;
    }
    if (soNome === "ambigua" && !comNome) rel.cegAmbigua.push(String(nome).trim());
    const id = `ceg-x-${curto(`${comId || ""}|${k}`)}`;
    const row = { id, comunidade_id: comId, gom_id: null, nome: String(nome).trim(), legado: null };
    t.cegs.push(row); cegsNovas.set(id, row); guardaCeg(row); rel.criadas.cegs.push(`${String(nome).trim()}${comNome ? ` (${comNome})` : ""}`);
    return id;
  };

  const provaRow = (alvo, alvoId, x) => {
    const id = `prova-${alvo}-${alvoId}`;
    if (!txt(x.prova) && !txt(x.provaLink)) { if (T.provas.has(id)) del.provas.push({ id }); return; }
    t.provas.push({ id, tipo: txt(x.provaLink) ? "link" : "mensagem", texto: txt(x.prova), link: txt(x.provaLink), alvo, alvo_id: alvoId });
  };
  const compRow = (cobId, x) => {
    const id = `prova-comp-${cobId}`;
    if (!/^[0-9a-f]{32}$/.test(x.comprovanteAsset || "")) { if (T.provas.has(id)) del.provas.push({ id }); return; }
    t.provas.push({ id, tipo: "picpay", texto: txt(x.pagoProva), arquivo: x.comprovanteAsset, alvo: "cobrancas", alvo_id: cobId });
  };
  // campos do documento que viram prova e não ficam no legado (a prova é a fonte)
  const semProva = (x) => { const { comprovanteAsset, ...r } = x; return r; };
  const travadoDe = (x) => arr(x.travado).filter((s) => typeof s === "string");

  const add = {
    comunidades(d) {
      const x = semPix(d.data); contaPix(d.data);
      const id = `com-${d.id}`;
      if (!txt(x.nome)) return;
      t.comunidades.push({ id, nome: x.nome.trim(), apelido: txt(x.apelido), situacao: txt(x.situacao), sigla: txt(x.sigla), cor: txt(x.cor), notas: txt(x.obs), travado: travadoDe(x), legado: x });
      comPorNome.set(norm(x.nome), id); if (txt(x.apelido)) comPorNome.set(norm(x.apelido), id);
      for (const n of separarGoms(x.goms)) gom(n, id, false);
    },
    gruposwa(d) {
      const x = semPix(d.data); if (!txt(x.nome)) return;
      t.grupos_wa.push({ id: `grp-${d.id}`, comunidade_id: comunidade(x.comunidade), nome: x.nome.trim(), cat: txt(x.cat), arquivado: !!x.arquivado, legado: x });
    },
    cegs(d) {
      const x = semPix(d.data); if (!txt(x.nome)) return;
      const comId = comunidade(x.comunidade), id = `ceg-${d.id}`;
      const row = { id, comunidade_id: comId, gom_id: x.gom ? gom(x.gom, comId) : null, nome: x.nome.trim(), grupo_wa: txt(x.grupo), planilha: txt(x.planilha), forms: txt(x.forms), origem: txt(x.origem), status: txt(x.status), conferido_em: data(x.conferidoEm), notas: txt(x.obs), travado: travadoDe(x), legado: x };
      t.cegs.push(row); guardaCeg(row);
    },
    itens(d) {
      const x = semPix(semProva(d.data)); contaPix(d.data);
      const cegId = x.ceg ? ceg(x.ceg, x.comunidade) : null;
      const claimId = `claim-${d.id}`;
      const trav = travadoDe(x);
      t.claims.push({ id: claimId, ceg_id: cegId, texto: txt(x.item) || "(sem nome)", valor: valorDe(x.valor, `item ${d.id}`), ordem: valor(x.ord), notas: txt(x.obs), travado: trav, legado: x });
      provaRow("claims", claimId, x);
      const cards = arr(x.cards).filter(Boolean);
      const etiquetas = String(x.etiquetas || "").split(",").map((e) => e.trim()).filter(Boolean);
      const atuais = [...T.itens.values()].filter((i) => i.claim_id === claimId).sort((a, b) => (a.id < b.id ? -1 : 1));
      const usados = new Set(atuais.map((i) => i.id));
      const casa = (card) => { const i = atuais.findIndex((r) => (r.card_id || null) === (card || null) && !r._usado); if (i < 0) return null; atuais[i]._usado = true; return atuais[i]; };
      const desejados = cards.length ? cards : [null];
      if (!cards.length) rel.itensSemCard++;
      const livre = (i) => {
        if (!atuais.length && !usados.size) return desejados.length === 1 ? `item-${d.id}` : `item-${d.id}-${i + 1}`;
        if (desejados.length === 1 && !usados.has(`item-${d.id}`)) return `item-${d.id}`;
        let n = 1; while (usados.has(`item-${d.id}-${n}`)) n++; return `item-${d.id}-${n}`;
      };
      const foto = (x.fotoItem || null);
      desejados.forEach((card, i) => {
        const ex = casa(card);
        const id = ex ? ex.id : livre(i); usados.add(id);
        const row = { id, card_id: card, descricao: desejados.length === 1 || !card ? txt(x.item) : null, membro: txt(x.membro), tipo: txt(x.tipo), claim_id: claimId, ceg_id: cegId, status: txt(x.status), etiquetas, travado: trav, notas: txt(x.obs) };
        if (!ex) { row.origem = x.ceg ? "ceg" : "compra"; if (foto) row.foto = foto; }
        t.itens.push(row);
        if (ex && txt(x.status) && ex.status !== txt(x.status)) t.item_status.push({ id: `st-${id}-${curto(txt(x.status) + hoje)}`, item_id: id, status: txt(x.status), em: hoje });
      });
      for (const r of atuais) if (!r._usado) del.itens.push({ id: r.id });
      for (const r of atuais) delete r._usado;
    },
    acervo(d) {
      const x = semPix(d.data);
      t.itens.push({ id: `acervo-${d.id}`, card_id: null, descricao: txt(x.nome), membro: txt(x.membro), tipo: txt(x.tipo) || "Merch", era: txt(x.era), origem: "acervo", status: x.st === "caminho" ? "Enviado" : "Recebido", legado: x });
    },
    cobrancas(d) {
      const x = semPix(semProva(d.data)); contaPix(d.data);
      const id = `cob-${d.id}`;
      t.cobrancas.push({ id, direcao: "pagar", comunidade_id: comunidade(x.comunidade), ceg_id: x.ceg ? ceg(x.ceg, x.comunidade) : null, referente: txt(x.referente), tipo: txt(x.tipo), valor: valorDe(x.valor, `cobrança ${d.id}`), prazo: data(x.prazo), prazo_nota: txt(x.prazoNota), status: txt(x.status), onde_olhar: txt(x.grupo), aviso_em: data(x.aviso), pago_em: data(x.pagoEm), conferido_em: data(x.conferidoEm), pabo_id: txt(x.paboId), notas: txt(x.obs), travado: travadoDe(x), legado: x });
      provaRow("cobrancas", id, x); compRow(id, d.data);
    },
    repasses(d) {
      const x = semPix(d.data);
      const id = `rep-${d.id}`;
      t.cobrancas.push({ id, direcao: "receber", comunidade_id: comunidade(x.comunidade), ceg_id: x.ceg ? ceg(x.ceg, x.comunidade) : null, pessoa: txt(x.pessoa), referente: txt(x.item), tipo: "Repasse", valor: valorDe(x.valor, `repasse ${d.id}`), status: x.pago === true || norm(x.pago) === "sim" ? "Paga" : "Pendente", aviso_em: data(x.data), onde_olhar: txt(x.grupo), notas: txt(x.obs), travado: travadoDe(x), legado: x });
      provaRow("cobrancas", id, x);
    },
    envios(d) {
      const x = semPix(d.data);
      const comId = comunidade(x.comunidade), id = `env-${d.id}`;
      t.envios.push({ id, comunidade_id: comId, gom_id: x.gom ? gom(x.gom, comId) : null, tipo: txt(x.tipo), status: txt(x.status), prazo: data(x.prazo), prazo_nota: txt(x.prazoNota), rastreio: txt(x.rastreio), como_pedir: txt(x.comoPedir), onde_olhar: txt(x.grupo), itens_txt: txt(x.itens), notas: txt(x.obs), travado: travadoDe(x), legado: x });
      provaRow("envios", id, x);
    },
    caixa(d) {
      const x = semPix(d.data);
      const cegRef = x.ceg && x.ceg.id ? `ceg-${x.ceg.id}` : null;
      t.sugestoes.push({ id: String(d.id), origem: txt(x.origem), estado: txt(x.estado), recebido_em: txt(x.recebidoEm), texto: txt(x.texto), fonte: txt(x.fonte), arquivo: txt(x.arquivo), hash: txt(x.hash), resumo: txt(x.resumo), ceg_id: cegRef && (T.cegs.has(cegRef) || cegsNovas.has(cegRef) ? cegRef : null), ceg: x.ceg || null, total_devido: valor(x.totalDevido), sem_valor: Number.isInteger(x.semValor) ? x.semValor : null, pergunta: txt(x.pergunta), candidatas: x.candidatas || null, registros: arr(x.registros), erro: txt(x.erro), repetidos: Number.isInteger(x.repetidos) ? x.repetidos : null, legado: (({ fonte, registros, ...r }) => r)(x) });
    },
    quadros(d) {
      const x = semPix(d.data), comId = txt(x.com) ? comunidade(x.com) : null;
      t.quadros.push({ id: `quad-${d.id}`, comunidade_id: comId, gom_id: txt(x.gom) ? gom(x.gom, comId) : null, gom_nome: txt(x.gom), comunidade_nome: txt(x.com), rasc: x.rasc && typeof x.rasc === "object" ? x.rasc : {}, notas: x.notas && typeof x.notas === "object" ? x.notas : {}, travado: travadoDe(x), legado: (({ rasc, notas, ...r }) => r)(x) });
    },
    binder(d) {
      const x = semPix(d.data);
      if (d.id !== "meta") return add.avulsos(d);
      t.binder_meta.push({ copias: x.n && typeof x.n === "object" ? x.n : {}, troca: arr(x.tr), metas: arr(x.g), legado: x });
    },
    colecao(d) {
      const grupo = String(d.id), s = d.data && d.data.s && typeof d.data.s === "object" ? d.data.s : {};
      const antes = [...T.posse.values()].filter((r) => r.grupo === grupo);
      for (const [card, estado] of Object.entries(s)) if (estado) t.posse.push({ grupo, card_id: card, estado: String(estado) });
      for (const r of antes) if (!s[r.card_id]) del.posse.push({ card_id: r.card_id });
    },
    cardsnovos(d) {
      const x = semPix(d.data);
      t.cards_novos.push({ id: `cn-${d.id}`, membro: txt(x.m), era: txt(x.e), versao: txt(x.v), tipo: txt(x.t), legado: x });
    },
    fotos(d) {
      const x = d.data || {};
      t.card_fotos.push({ card_id: String(d.id), foto: /^[0-9a-f]{32}$/.test(x.asset || "") ? x.asset : (txt(x.asset) || ""), url: txt(x.url), legado: x });
      // espelho no item (quando a chave é de um pedido ou do acervo)
      for (const k of [`item-${d.id}`, String(d.id)]) if (T.itens.has(k)) t.itens.push({ id: k, foto: txt(x.asset) });
    },
    meta(d) { t.meta.push({ chave: String(d.id), dados: semPix(d.data) }); },
    avulsos(d) { t.avulsos.push({ col: d.col, id: String(d.id), dados: semPix(d.data) }); },
  };
  const rotulo = (d) => add[d.col] ? add[d.col](d) : add.avulsos(d);

  // ---- apagar um documento ----
  const apagar = {
    comunidades: (id) => del.comunidades.push({ id: `com-${id}` }),
    gruposwa: (id) => del.grupos_wa.push({ id: `grp-${id}` }),
    cegs: (id) => del.cegs.push({ id: `ceg-${id}` }),
    itens(id) { for (const i of T.itens.values()) if (i.claim_id === `claim-${id}`) del.itens.push({ id: i.id }); del.provas.push({ id: `prova-claims-claim-${id}` }); del.claims.push({ id: `claim-${id}` }); },
    acervo: (id) => del.itens.push({ id: `acervo-${id}` }),
    cobrancas(id) { del.provas.push({ id: `prova-cobrancas-cob-${id}` }, { id: `prova-comp-cob-${id}` }); del.cobrancas.push({ id: `cob-${id}` }); },
    repasses(id) { del.provas.push({ id: `prova-cobrancas-rep-${id}` }); del.cobrancas.push({ id: `rep-${id}` }); },
    envios(id) { del.provas.push({ id: `prova-envios-env-${id}` }); del.envios.push({ id: `env-${id}` }); },
    caixa: (id) => del.sugestoes.push({ id: String(id) }),
    quadros: (id) => del.quadros.push({ id: `quad-${id}` }),
    binder: (id) => (id === "meta" ? del.binder_meta.push({}) : del.avulsos.push({ col: "binder", id })),
    colecao(id) { for (const r of T.posse.values()) if (r.grupo === String(id)) del.posse.push({ card_id: r.card_id }); },
    cardsnovos: (id) => del.cards_novos.push({ id: `cn-${id}` }),
    fotos(id) { del.card_fotos.push({ card_id: String(id) }); for (const k of [`item-${id}`, String(id)]) if (T.itens.has(k)) t.itens.push({ id: k, foto: null }); },
    meta: (id) => del.meta.push({ chave: String(id) }),
  };
  const remover = (col, id) => (apagar[col] ? apagar[col](id) : del.avulsos.push({ col, id: String(id) }));

  return { t, del, rel, add, rotulo, remover, T, comunidade, gom, ceg, valorDe, contaPix, provaRow, compRow, semProva, travadoDe };
}

// a gravação única de uma linha: o que mudou entra, o resto fica
const saida = (m) => ({ up: Object.fromEntries(ORDEM.map((x) => [x, m.t[x]]).filter(([, v]) => v.length)), del: Object.fromEntries(ORDEM.slice().reverse().map((x) => [x, m.del[x]]).filter(([, v]) => v.length)), relatorio: m.rel });

// grava um documento (set) -> o que fazer nas tabelas
function escrever(col, id, dataDoc, T, op) {
  const m = novoMapeador(T, op);
  m.rotulo({ col, id: String(id), data: dataDoc || {} });
  return saida(m);
}
// apaga um documento -> o que fazer nas tabelas
function apagarDoc(col, id, T, op) {
  const m = novoMapeador(T, op);
  m.remover(col, String(id));
  return saida(m);
}

// ---------- lote: a migração ----------
function mapear(docs) {
  const by = (col) => docs.filter((d) => d.col === col);
  const m = novoMapeador({});
  const t = m.t, rel = m.rel;
  // fotos (valor de chave) viram card_fotos; as de pedido também vão pro item
  const fotos = new Map(by("fotos").map((d) => [d.id, d.data]));
  // a ordem importa: comunidades e CEGs antes de quem as cita
  for (const col of ["comunidades", "gruposwa", "cegs", "itens", "acervo", "cobrancas", "repasses", "envios", "caixa", "quadros", "binder", "colecao", "cardsnovos", "fotos", "meta"]) for (const d of by(col)) m.rotulo(d);
  const conhecidas = new Set(COLS_DOCS);
  for (const d of docs) if (!conhecidas.has(d.col)) m.rotulo(d);
  // espelho da foto no item (pedido com um card só: item-<id>; acervo: acervo-<id>)
  for (const it of t.itens) { const f = fotos.get(it.id) || fotos.get(String(it.id).replace(/^item-/, "")); if (f && !it.foto && /^[0-9a-f]{32}$/.test(f.asset || "")) it.foto = f.asset; }
  const FORA = new Set(["Set não fechou", "Claim perdida", "Repassei", "Abandonado", "Cancelado"]);
  const porCard = new Map();
  for (const it of t.itens) if (it.card_id && !FORA.has(it.status)) porCard.set(it.card_id, (porCard.get(it.card_id) || 0) + 1);
  rel.repetidos = [...porCard.values()].filter((n) => n > 1).length;
  rel.contagem = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.length]));
  return { tabelas: t, relatorio: rel };
}

// ---------- linhas -> documento ----------
const ov = (leg, key, colVal, ig) => { // junta a coluna ao legado: a coluna manda quando tem valor
  if (colVal == null || (Array.isArray(colVal) && !colVal.length && !(key in leg))) return;
  const old = leg[key];
  if (old !== undefined && ig && ig(old, colVal)) return; // legado já diz o mesmo (ex.: "9,45" vs 9.45)
  leg[key] = colVal;
};
const igNum = (a, b) => valor(a) === b;
const igTxt = (a, b) => txt(a) === b;
const igData = (a, b) => data(a) === b;
const igTempo = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return !Number.isNaN(x) && x === y; };

function paraDocs(T0, quais) {
  const T = mapas(T0);
  const lista = (t) => [...T[t].values()];
  const nomeCom = (id) => (id && T.comunidades.get(id) ? T.comunidades.get(id).nome : null);
  const nomeGom = (id) => (id && T.goms.get(id) ? T.goms.get(id).nome : null);
  const cegInfo = (id) => { const r = id && T.cegs.get(id); return r ? { nome: r.nome, com: nomeCom(r.comunidade_id) } : null; };
  const idDoc = (pref, id) => (String(id).startsWith(pref) ? String(id).slice(pref.length) : String(id));
  const out = {};
  const quer = (c) => !quais || quais.includes(c);
  const pegaTrav = (d, r) => { if (r.travado && r.travado.length) d.travado = r.travado.slice(); else if ("travado" in d) d.travado = []; };
  // o nome que estava escrito no documento vale enquanto ainda aponta pro mesmo registro
  const mesmo = (leg, canon, apel) => (leg && canon && (norm(leg) === norm(canon) || (apel && norm(leg) === norm(apel))) ? leg : canon);
  const comNome = (leg, id) => { const r = id && T.comunidades.get(id); return r ? mesmo(leg, r.nome, r.apelido) : null; };

  if (quer("comunidades")) {
    out.comunidades = new Map();
    for (const r of lista("comunidades")) {
      const d = { ...(r.legado || {}) }; d.nome = r.nome;
      ov(d, "apelido", r.apelido, igTxt); ov(d, "situacao", r.situacao, igTxt); ov(d, "sigla", r.sigla, igTxt); ov(d, "cor", r.cor, igTxt); ov(d, "obs", r.notas, igTxt);
      const gs = lista("goms").filter((x) => x.comunidade_id === r.id).map((x) => x.nome);
      if (gs.length) { const a = separarGoms(d.goms).map(norm).sort(), b = gs.map(norm).sort(); if (!eq(a, b)) d.goms = gs.join(" e "); }
      pegaTrav(d, r); out.comunidades.set(idDoc("com-", r.id), d);
    }
  }
  if (quer("gruposwa")) {
    out.gruposwa = new Map();
    for (const r of lista("grupos_wa")) {
      const d = { ...(r.legado || {}) }; d.nome = r.nome;
      const c = comNome(d.comunidade, r.comunidade_id); if (c) d.comunidade = c;
      ov(d, "cat", r.cat, igTxt); if (r.arquivado) d.arquivado = true; else if ("arquivado" in d) d.arquivado = false;
      out.gruposwa.set(idDoc("grp-", r.id), d);
    }
  }
  if (quer("cegs")) {
    out.cegs = new Map();
    for (const r of lista("cegs")) {
      const d = { ...(r.legado || {}) }; d.nome = r.nome;
      const c = comNome(d.comunidade, r.comunidade_id); if (c) d.comunidade = c;
      const gm = nomeGom(r.gom_id); if (gm) d.gom = mesmo(d.gom, gm);
      ov(d, "grupo", r.grupo_wa, igTxt); ov(d, "planilha", r.planilha, igTxt); ov(d, "forms", r.forms, igTxt); ov(d, "origem", r.origem, igTxt); ov(d, "status", r.status, igTxt);
      ov(d, "conferidoEm", r.conferido_em, igData); ov(d, "obs", r.notas, igTxt);
      pegaTrav(d, r); out.cegs.set(idDoc("ceg-", r.id), d);
    }
  }
  if (quer("itens")) {
    out.itens = new Map();
    const porClaim = new Map();
    for (const i of lista("itens")) if (i.claim_id) { if (!porClaim.has(i.claim_id)) porClaim.set(i.claim_id, []); porClaim.get(i.claim_id).push(i); }
    const provaDe = new Map(lista("provas").filter((p) => p.alvo === "claims").map((p) => [p.alvo_id, p]));
    for (const cl of lista("claims")) {
      const its = (porClaim.get(cl.id) || []).sort((a, b) => (a.id < b.id ? -1 : 1));
      const d = { ...(cl.legado || {}) }; d.item = cl.texto;
      const ci = cegInfo(cl.ceg_id); if (ci) { d.ceg = mesmo(d.ceg, ci.nome); const cc = T.cegs.get(cl.ceg_id); if (ci.com) d.comunidade = comNome(d.comunidade, cc.comunidade_id); }
      ov(d, "valor", cl.valor, igNum); ov(d, "obs", cl.notas, igTxt); ov(d, "ord", cl.ordem, igNum);
      const cards = its.map((i) => i.card_id).filter(Boolean);
      if (cards.length) d.cards = cards; else if (arr(d.cards).length) d.cards = [];
      const p = its[0];
      if (p) {
        ov(d, "membro", p.membro, igTxt); ov(d, "tipo", p.tipo, igTxt); ov(d, "status", p.status, igTxt);
        if (p.etiquetas && p.etiquetas.length) { const e = String(d.etiquetas || "").split(",").map((s) => s.trim()).filter(Boolean); if (!eq(e, p.etiquetas)) d.etiquetas = p.etiquetas.join(", "); }
        else if ("etiquetas" in d && String(d.etiquetas || "").trim() && !(its.length)) d.etiquetas = "";
      }
      const pr = provaDe.get(cl.id); if (pr) { if (pr.texto) d.prova = pr.texto; if (pr.link) d.provaLink = pr.link; } else { if ("prova" in d) d.prova = ""; if ("provaLink" in d) d.provaLink = ""; }
      pegaTrav(d, cl.travado && cl.travado.length ? cl : (p || cl));
      out.itens.set(idDoc("claim-", cl.id), d);
    }
    // itens avulsos (sem claim) que não são do acervo: aparecem como pedido
    for (const i of lista("itens")) {
      if (i.claim_id || i.origem === "acervo") continue;
      const d = { ...(i.legado || {}), item: i.descricao || "", membro: i.membro || "", status: i.status || "", cards: i.card_id ? [i.card_id] : [] };
      out.itens.set(idDoc("item-", i.id), d);
    }
  }
  if (quer("acervo")) {
    out.acervo = new Map();
    for (const r of lista("itens")) {
      if (r.origem !== "acervo") continue;
      const d = { ...(r.legado || {}) }; ov(d, "nome", r.descricao, igTxt); ov(d, "membro", r.membro, igTxt); ov(d, "tipo", r.tipo, igTxt); ov(d, "era", r.era, igTxt);
      if ((d.st === "caminho") !== (r.status === "Enviado")) d.st = r.status === "Enviado" ? "caminho" : "";
      out.acervo.set(idDoc("acervo-", r.id), d);
    }
  }
  const cobDoc = (r) => {
    const d = { ...(r.legado || {}) };
    const c = comNome(d.comunidade, r.comunidade_id); if (c) d.comunidade = c;
    const ci = cegInfo(r.ceg_id); if (ci) { d.ceg = mesmo(d.ceg, ci.nome); if (!c && ci.com) d.comunidade = comNome(d.comunidade, T.cegs.get(r.ceg_id).comunidade_id); }
    return d;
  };
  const provaDeCob = new Map(); for (const p of lista("provas")) if (p.alvo === "cobrancas" || p.alvo === "envios") provaDeCob.set(`${p.tipo === "picpay" ? "comp" : "prova"}|${p.alvo_id}`, p);
  const provaCampos = (d, r) => {
    const pr = provaDeCob.get(`prova|${r.id}`);
    if (pr) { if (pr.texto) d.prova = pr.texto; if (pr.link) d.provaLink = pr.link; } else { if ("prova" in d) d.prova = ""; if ("provaLink" in d) d.provaLink = ""; }
  };
  if (quer("cobrancas")) {
    out.cobrancas = new Map();
    for (const r of lista("cobrancas")) {
      if (r.direcao === "receber") continue;
      const d = cobDoc(r);
      ov(d, "referente", r.referente, igTxt); ov(d, "tipo", r.tipo, igTxt); ov(d, "valor", r.valor, igNum); ov(d, "prazo", r.prazo, igData); ov(d, "prazoNota", r.prazo_nota, igTxt);
      ov(d, "status", r.status, igTxt); ov(d, "grupo", r.onde_olhar, igTxt); ov(d, "aviso", r.aviso_em, igData); ov(d, "pagoEm", r.pago_em, igData); ov(d, "conferidoEm", r.conferido_em, igData);
      ov(d, "paboId", r.pabo_id, igTxt); ov(d, "obs", r.notas, igTxt); pegaTrav(d, r); provaCampos(d, r);
      const cp = provaDeCob.get(`comp|${r.id}`); if (cp) d.comprovanteAsset = cp.arquivo;
      out.cobrancas.set(idDoc("cob-", r.id), d);
    }
  }
  if (quer("repasses")) {
    out.repasses = new Map();
    for (const r of lista("cobrancas")) {
      if (r.direcao !== "receber") continue;
      const d = cobDoc(r);
      ov(d, "pessoa", r.pessoa, igTxt); ov(d, "item", r.referente, igTxt); ov(d, "valor", r.valor, igNum); ov(d, "data", r.aviso_em, igData); ov(d, "grupo", r.onde_olhar, igTxt); ov(d, "obs", r.notas, igTxt);
      const pagoLeg = d.pago === true || norm(d.pago) === "sim";
      if (pagoLeg !== (r.status === "Paga")) d.pago = r.status === "Paga" ? "Sim" : "Não";
      pegaTrav(d, r); provaCampos(d, r);
      out.repasses.set(idDoc("rep-", r.id), d);
    }
  }
  if (quer("envios")) {
    out.envios = new Map();
    for (const r of lista("envios")) {
      const d = { ...(r.legado || {}) };
      const c = comNome(d.comunidade, r.comunidade_id); if (c) d.comunidade = c;
      const gm = nomeGom(r.gom_id); if (gm) d.gom = mesmo(d.gom, gm);
      ov(d, "tipo", r.tipo, igTxt); ov(d, "status", r.status, igTxt); ov(d, "prazo", r.prazo, igData); ov(d, "prazoNota", r.prazo_nota, igTxt); ov(d, "rastreio", r.rastreio, igTxt);
      ov(d, "comoPedir", r.como_pedir, igTxt); ov(d, "grupo", r.onde_olhar, igTxt); ov(d, "itens", r.itens_txt, igTxt); ov(d, "obs", r.notas, igTxt);
      pegaTrav(d, r); provaCampos(d, r);
      out.envios.set(idDoc("env-", r.id), d);
    }
  }
  if (quer("caixa")) {
    out.caixa = new Map();
    for (const r of lista("sugestoes")) {
      const d = { ...(r.legado || {}) };
      ov(d, "origem", r.origem, igTxt); ov(d, "estado", r.estado, igTxt); ov(d, "recebidoEm", r.recebido_em, igTempo); ov(d, "texto", r.texto, igTxt); ov(d, "fonte", r.fonte, igTxt);
      ov(d, "arquivo", r.arquivo, igTxt); ov(d, "hash", r.hash, igTxt); ov(d, "resumo", r.resumo, igTxt); if (r.ceg) d.ceg = r.ceg; ov(d, "totalDevido", r.total_devido, igNum);
      if (r.sem_valor != null) d.semValor = r.sem_valor; ov(d, "pergunta", r.pergunta, igTxt); if (r.candidatas) d.candidatas = r.candidatas; if (arr(r.registros).length || "registros" in d) d.registros = arr(r.registros);
      ov(d, "erro", r.erro, igTxt); if (r.repetidos != null) d.repetidos = r.repetidos;
      out.caixa.set(String(r.id), d);
    }
  }
  if (quer("quadros")) {
    out.quadros = new Map();
    for (const r of lista("quadros")) {
      const d = { ...(r.legado || {}) };
      const g = nomeGom(r.gom_id); const c = comNome(d.com, r.comunidade_id);
      d.gom = g ? mesmo(d.gom, g) : (r.gom_nome || d.gom || ""); d.com = c || r.comunidade_nome || d.com || "";
      d.rasc = r.rasc || {}; if (r.notas && Object.keys(r.notas).length) d.notas = r.notas; else if ("notas" in d) d.notas = r.notas || {};
      out.quadros.set(idDoc("quad-", r.id), d);
    }
  }
  if (quer("binder")) {
    out.binder = new Map();
    const b = T.binder_meta.get("_") || lista("binder_meta")[0];
    if (b) { const d = { ...(b.legado || {}) }; d.n = b.copias || {}; d.tr = b.troca || []; d.g = b.metas || []; out.binder.set("meta", d); }
    for (const r of lista("avulsos")) if (r.col === "binder") out.binder.set(r.id, r.dados);
  }
  if (quer("colecao")) {
    out.colecao = new Map();
    for (const r of lista("posse")) { if (!out.colecao.has(r.grupo)) out.colecao.set(r.grupo, { s: {} }); out.colecao.get(r.grupo).s[r.card_id] = r.estado; }
  }
  if (quer("cardsnovos")) {
    out.cardsnovos = new Map();
    for (const r of lista("cards_novos")) { const d = { ...(r.legado || {}) }; ov(d, "m", r.membro, igTxt); ov(d, "e", r.era, igTxt); ov(d, "v", r.versao, igTxt); ov(d, "t", r.tipo, igTxt); out.cardsnovos.set(idDoc("cn-", r.id), d); }
  }
  if (quer("fotos")) {
    out.fotos = new Map();
    for (const r of lista("card_fotos")) {
      const d = { ...(r.legado || {}) };
      if (r.foto) d.asset = r.foto; if (r.url) d.url = r.url;
      out.fotos.set(String(r.card_id), d);
    }
  }
  if (quer("meta")) { out.meta = new Map(); for (const r of lista("meta")) out.meta.set(r.chave, r.dados || {}); }
  // coleções sem tabela própria
  const outras = new Set(lista("avulsos").map((r) => r.col));
  for (const c of outras) { if (c === "binder") continue; if (!quer(c)) continue; if (!out[c]) out[c] = new Map(); }
  for (const r of lista("avulsos")) if (r.col !== "binder" && out[r.col]) out[r.col].set(r.id, r.dados);
  return out;
}

g.StayV2 = { norm, curto, txt, valor, SEM_PIX, semPix, separarGoms, TABELAS, ORDEM, PK, pkDe, pkVal, DEPENDE, COLS_DOCS, tabelasDe, mapear, escrever, apagarDoc, paraDocs, mapas };
})(typeof window !== "undefined" ? window : globalThis);

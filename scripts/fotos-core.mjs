// Caça de fotos: acha FOTOS BOAS (só o link) pros cards que só têm a folha
// borrada do catálogo e propõe pra ela aprovar. O robô só sugere: quem escolhe
// é ela (no app, 1 toque). Nada de IA decidindo, nada de cópia de foto.
//
// Onde ficam as sugestões: coleção "fotosug" da tabela docs (a mesma que o app
// já lê), uma linha por card, id = id do card (ids previsíveis, rodar de novo
// não duplica):  { c:[{url,fonte,w,h,nota,por}], nao:[urls que ela descartou],
// tentouEm, achouEm }. Foto que ela escolheu fica em fotos/<id> com trava:true;
// o robô nunca mexe nesse card.
//
// Fontes abertas e legais (ver docs/fontes-catalogo.md, seção "Caça de fotos"):
//   extra   data/fotos-extra.json: links que ela ou eu juntamos à mão (nota alta)
//   irmao   o mesmo membro+era+versão em outro card do catálogo que já tem foto boa
//   wiki    arquivos de imagem da wiki stray-kids.fandom.com (API pública do MediaWiki)
//   poca    foto de produto da POCA MALL (catalogo_loja), só pra álbum, nota baixa

export const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const norm = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Mesma regra do app (index.html okUrl): link que o app não mostra não vale.
export const urlOk = (u) => /^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._~\/%=&?+-]*$/.test(u || "");

// Foto boa: 300px ou mais de largura (a folha tem 160).
export const LARGURA_BOA = 300;
export const MAX_CAND = 5;
export const SEMANA_MS = 7 * 24 * 3600 * 1000;

export function fonteLabel(f) {
  return { extra: "link guardado", irmao: "mesmo set no catálogo", wiki: "wiki do Stray Kids", poca: "POCA MALL (foto do produto)" }[f] || f;
}

// ---- fontes ----
// Cada fonte devolve Map(idDoCard -> [{url,fonte,w,h,nota,por}]).

export function fonteExtra(cards, extra) {
  const out = new Map();
  for (const c of cards) {
    const l = (extra && extra[c.i]) || [];
    const ok = l.filter((x) => urlOk(x.url)).map((x) => ({ url: x.url, fonte: "extra", w: x.w || null, h: x.h || null, nota: 95, por: x.nota || "link guardado à mão" }));
    if (ok.length) out.set(c.i, ok);
  }
  return out;
}

const chaveSet = (c) => [norm(c.m), norm(c.e), norm(c.v)].join("|");

// Irmãos: mesmo membro + era + nome de versão, em outro card que já tem foto
// boa (c.u, com c.w >= LARGURA_BOA). Mesmo tipo e origem = quase certeza.
export function fonteIrmaos(cards, todos) {
  const por = new Map();
  for (const c of todos) if (c.u && (c.w || 0) >= LARGURA_BOA) { const k = chaveSet(c); (por.get(k) || por.set(k, []).get(k)).push(c); }
  const out = new Map();
  for (const c of cards) {
    const l = (por.get(chaveSet(c)) || []).filter((x) => x.i !== c.i);
    if (!l.length) continue;
    out.set(c.i, l.map((x) => {
      const igual = x.t === c.t && x.o === c.o;
      return { url: x.u, fonte: "irmao", w: x.w, h: null, nota: igual ? 80 : 55, por: `${x.v} · ${x.t} ${x.o} (${x.i})` };
    }));
  }
  return out;
}

// POCA MALL: foto do produto. Só álbum, e só se a era e a versão aparecem no
// nome do produto. É foto de produto (capa/pacote), não do photocard: nota baixa.
export function fontePoca(cards, loja) {
  const out = new Map();
  const prods = (loja || []).filter((p) => p.imagem && urlOk(p.imagem) && p.nome).map((p) => ({ p, n: norm(p.nome) }));
  for (const c of cards) {
    if (c.t !== "Álbum") continue;
    const e = norm(c.e), v = norm(c.v).replace(/ ver$| version$/, "");
    if (!e || !v) continue;
    const hit = prods.filter(({ n }) => n.includes(e) && n.includes(v));
    if (hit.length) out.set(c.i, hit.map(({ p }) => ({ url: p.imagem, fonte: "poca", w: null, h: null, nota: 30, por: p.nome })));
  }
  return out;
}

// Wiki: procura arquivos de imagem ("File:") com a era, o membro e "photocard".
// Só serve se o NOME do arquivo traz o membro e a versão (ou a era). Pouca
// coisa hoje (a wiki quase não tem photocard avulso), mas é gratuito e legal.
export async function fonteWiki(cards, { fetchJson, limite = 60 } = {}) {
  const out = new Map();
  const cache = new Map();
  let usadas = 0;
  for (const c of cards) {
    const q = `${c.e} ${c.m} photocard`;
    if (!cache.has(q)) {
      if (usadas >= limite) continue;
      usadas++;
      try {
        const j = await fetchJson({ action: "query", generator: "search", gsrsearch: q, gsrnamespace: "6", gsrlimit: "10", prop: "imageinfo", iiprop: "url|size", format: "json" });
        cache.set(q, Object.values((j.query && j.query.pages) || {}).map((p) => ({ nome: String(p.title || "").replace(/^File:/, ""), ii: (p.imageinfo || [])[0] })).filter((x) => x.ii));
      } catch { cache.set(q, []); }
    }
    const m = norm(c.m), e = norm(c.e), v = norm(c.v).replace(/ ver$| version$/, "");
    const ach = (cache.get(q) || []).filter((x) => {
      const n = norm(x.nome);
      return /photocard|photo card| pc /.test(" " + n + " ") && n.includes(m) && n.includes(e) && (!v || n.includes(v));
    }).filter((x) => urlOk((x.ii.url || "").split("/revision/")[0] + "") || urlOk(x.ii.url));
    if (ach.length) out.set(c.i, ach.map((x) => ({ url: x.ii.url, fonte: "wiki", w: x.ii.width || null, h: x.ii.height || null, nota: 75, por: x.nome })));
  }
  return out;
}

// ---- ranking e mescla ----
// nota final = nota da fonte, +10 se a largura é boa (>=300) ou -25 se
// sabidamente menor que isso. Empate: maior largura primeiro.
export function pontuar(c) {
  let n = c.nota;
  if (c.w != null) n += c.w >= LARGURA_BOA ? 10 : -25;
  return Math.max(0, Math.min(100, n));
}

export function juntarCandidatos(listas, { nao = [] } = {}) {
  const vistos = new Set(nao);
  const todos = [];
  for (const l of listas) for (const c of l || []) {
    if (!urlOk(c.url) || vistos.has(c.url)) continue;
    vistos.add(c.url);
    todos.push({ ...c, nota: pontuar(c) });
  }
  todos.sort((a, b) => b.nota - a.nota || (b.w || 0) - (a.w || 0) || (a.url < b.url ? -1 : 1));
  return todos.slice(0, MAX_CAND);
}

// Quem entra na fila: sem foto boa, sem foto escolhida por ela (fotos/<id>), e
// ou nunca procurado, ou com candidatos já achados (atualiza), ou sem achado há
// mais de uma semana (volta pra fila).
export function precisaProcurar(card, { fotos, sug, agora = Date.now() }) {
  if (card.u && (card.w || 0) >= LARGURA_BOA) return false;
  if (fotos && fotos[card.i]) return false;
  const s = sug && sug[card.i];
  if (!s || !s.tentouEm) return true;
  if (s.c && s.c.length) return true;
  return agora - Date.parse(s.tentouEm) >= SEMANA_MS;
}

// Linha final de fotosug/<id>. Preserva o que ela descartou.
export function montarSugestao(card, cands, antigo, agora = new Date()) {
  const nao = (antigo && antigo.nao) || [];
  const c = juntarCandidatos([cands], { nao });
  const iso = agora.toISOString();
  return { c, nao, tentouEm: iso, ...(c.length ? { achouEm: (antigo && antigo.achouEm) || iso } : {}) };
}

// ---- Supabase (tabela docs) ----
const H = (key, extra) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra });

export async function lerDocs(url, key, owner, col) {
  const out = {};
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${url}/rest/v1/docs?owner=eq.${owner}&col=eq.${col}&select=id,data&order=id&offset=${off}&limit=1000`, { headers: H(key) });
    if (!r.ok) throw new Error(`Supabase (ler ${col}): HTTP ${r.status} ${await r.text()}`);
    const l = await r.json();
    for (const x of l) out[x.id] = x.data;
    if (l.length < 1000) break;
  }
  return out;
}

export async function gravarDocs(url, key, owner, col, linhas) {
  for (let i = 0; i < linhas.length; i += 200) {
    const lote = linhas.slice(i, i + 200).map(([id, data]) => ({ owner, col, id, data }));
    const r = await fetch(`${url}/rest/v1/docs?on_conflict=owner,col,id`, { method: "POST", headers: H(key, { Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(lote) });
    if (!r.ok) throw new Error(`Supabase (gravar ${col}): HTTP ${r.status} ${await r.text()}`);
  }
}

// Cards dela (pedidos ligados + marcados no binder): são os que aparecem no
// filtro "Sem foto". Com todos=true, o catálogo inteiro.
export function cardsDela(colecao, itens, posse) {
  const ids = new Set();
  for (const it of Object.values(itens || {})) for (const id of (it && it.cards) || []) ids.add(id);
  for (const p of Object.values(posse || {})) for (const id of Object.keys((p && p.s) || {})) ids.add(id);
  return colecao.items.filter((c) => ids.has(c.i));
}

const WIKI = "https://stray-kids.fandom.com/api.php";
export const wikiJson = async (params) => {
  const r = await fetch(`${WIKI}?${new URLSearchParams(params)}`, { headers: { "User-Agent": "staycollection-fotos/1.0 (app pessoal de coleção)" } });
  if (!r.ok) throw new Error(`wiki: HTTP ${r.status}`);
  return r.json();
};

// Roda tudo. deps injetáveis pros testes. Devolve { linhas, resumo }.
export async function cacarFotos({ colecao, cards, fotos, sug, loja, extra, fetchJson = wikiJson, limiteWiki = 60, limite = 400, agora = new Date() }) {
  const fila = cards.filter((c) => precisaProcurar(c, { fotos, sug, agora: agora.getTime() })).slice(0, limite);
  const fontes = [fonteExtra(fila, extra), fonteIrmaos(fila, colecao.items), fontePoca(fila, loja), await fonteWiki(fila, { fetchJson, limite: limiteWiki })];
  const linhas = [];
  const por = { extra: 0, irmao: 0, wiki: 0, poca: 0 };
  let acharam = 0;
  for (const c of fila) {
    const s = montarSugestao(c, fontes.flatMap((m) => m.get(c.i) || []), sug && sug[c.i], agora);
    if (s.c.length) { acharam++; for (const f of new Set(s.c.map((x) => x.fonte))) por[f]++; }
    const ant = sug && sug[c.i];
    if (ant && JSON.stringify({ ...ant, tentouEm: 0 }) === JSON.stringify({ ...s, tentouEm: 0 })) continue; // nada mudou: não regrava
    linhas.push([c.i, s]);
  }
  return { linhas, resumo: { naFila: fila.length, comCandidato: acharam, semCandidato: fila.length - acharam, porFonte: por } };
}

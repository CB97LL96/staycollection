// Lógica compartilhada do catálogo: buscar o que há de novo no CraftenSKZ e
// ler/gravar no Supabase (tabela catalogo_itens). Usado pelo script local
// (scripts/sync-catalogo.mjs) e pelo cron do Vercel (api/cron/sync-catalogo.js).
import { readFileSync } from "node:fs";

export const CRAFTENSKZ_BASE = "https://raw.githubusercontent.com/CraftenSKZ/StrayKidsPCCollector/main/data/";
export const CRAFTENSKZ_FONTES = ["korean_albums.json", "korean_pob.json", "japanese_albums.json", "japanese_pob.json"];

// Mesma classificação observada nos dados já existentes: toda entrada de
// "albums" fica Álbum; toda entrada de "pob" é POB, a menos que o nome bata
// com uma destas palavras-chave (nessa ordem de prioridade).
export function classificarTipo(category, name) {
  const isAlbum = category.endsWith("_albums");
  const o = category.startsWith("japanese_") ? "JP" : "KR";
  if (isAlbum) return { o, t: "Álbum" };
  const v = String(name || "");
  if (/\bld\b|lucky draw/i.test(v)) return { o, t: "Lucky draw" };
  if (/fansign/i.test(v)) return { o, t: "Fansign / fancall" };
  if (/broadcast/i.test(v)) return { o, t: "Broadcast" };
  if (/streaming event/i.test(v)) return { o, t: "Streaming event" };
  return { o, t: "POB" };
}

export async function buscarNovosCraftenSKZ(idsConhecidos) {
  const novos = [];
  for (const nome of CRAFTENSKZ_FONTES) {
    const r = await fetch(CRAFTENSKZ_BASE + nome);
    if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
    const lista = await r.json();
    for (const entry of lista) {
      if (idsConhecidos.has(entry.id)) continue;
      // Entradas "placeholder" do CraftenSKZ (categoria ainda não preenchida
      // de verdade) não têm "set" e costumam ter id "underconstruction".
      if (!entry.set || entry.id === "underconstruction") continue;
      const { o, t } = classificarTipo(entry.category, entry.name);
      novos.push({ i: entry.id, m: entry.member, e: entry.album, o, t, v: entry.name, s: entry.set });
      idsConhecidos.add(entry.id);
    }
  }
  return novos;
}

function sbHeaders(serviceKey, extra) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...extra };
}

async function sbPaginar(url, serviceKey, select) {
  const linhas = [];
  const pagina = 1000;
  for (let offset = 0; ; offset += pagina) {
    const r = await fetch(`${url}/rest/v1/catalogo_itens?select=${select}&order=i&offset=${offset}&limit=${pagina}`, {
      headers: sbHeaders(serviceKey),
    });
    if (!r.ok) throw new Error(`Supabase (ler ${select}): HTTP ${r.status} ${await r.text()}`);
    const lote = await r.json();
    linhas.push(...lote);
    if (lote.length < pagina) break;
  }
  return linhas;
}

export async function supabaseIdsConhecidos(url, serviceKey) {
  const linhas = await sbPaginar(url, serviceKey, "i");
  return new Set(linhas.map((l) => l.i));
}

export async function supabaseTodosItens(url, serviceKey) {
  return sbPaginar(url, serviceKey, "i,m,e,o,t,v,s,p");
}

export async function supabaseInserirItens(url, serviceKey, itens) {
  if (!itens.length) return;
  const r = await fetch(`${url}/rest/v1/catalogo_itens`, {
    method: "POST",
    headers: sbHeaders(serviceKey, { Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify(itens),
  });
  if (!r.ok) throw new Error(`Supabase (inserir): HTTP ${r.status} ${await r.text()}`);
}

// Junta os itens do Supabase com as folhas de fotos fixas (data/catalogo-fotos.json)
// pra montar o mesmo formato que o colecao.json sempre teve.
export async function gerarColecaoJson(url, serviceKey) {
  const fotos = JSON.parse(readFileSync(new URL("../data/catalogo-fotos.json", import.meta.url), "utf8"));
  const linhas = await supabaseTodosItens(url, serviceKey);
  const items = linhas.map((l) => {
    const it = { i: l.i, m: l.m, e: l.e, o: l.o, t: l.t, v: l.v, s: l.s };
    if (l.p) it.p = l.p;
    return it;
  });
  return {
    n: fotos.n,
    m: fotos.m,
    sheets: fotos.sheets,
    items,
    fonte: `CraftenSKZ (StrayKidsPCCollector), atualizado em ${new Date().toLocaleDateString("pt-BR")}`,
  };
}

// Importa duas fontes da wiki stray-kids.fandom.com (via API pública do
// MediaWiki, sem precisar de login nem de navegador) pra catalogo_eventos:
//
//   - a página "Season's Greetings": tem o nome oficial, data de
//     lançamento, editora/distribuidora, preço e o conteúdo item a item de
//     cada edição (Coreia e Japão, 2021 até a mais recente anunciada).
//   - a categoria "Merch events": pop-ups, cafés e exposições, um por
//     página, cada um com data(s), local e um parágrafo de contexto.
//
// Fonte de terceiros (comunidade da wiki), mas de acesso público e sem
// ambiguidade — nomes e datas são os que a própria wiki documenta, citando
// os anúncios oficiais. É o jeito mais confiável de preencher Season's
// Greetings/pop-up/eventos sem inventar nome de versão.
//
// Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente. Pode
// rodar de novo quando a wiki for editada; cada execução substitui as linhas
// antigas destas duas fontes, nunca duplica.
//
// Uso: node scripts/migrar-wiki-skz.mjs

const WIKI = "https://stray-kids.fandom.com/api.php";
const ABA_SG = "wiki:Season's Greetings";
const ABA_MERCH = "wiki:Merch events";

async function apiGet(params) {
  const url = `${WIKI}?${new URLSearchParams({ format: "json", ...params })}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`wiki API: HTTP ${r.status} (${url})`);
  return r.json();
}

async function wikitextDe(pagina) {
  const j = await apiGet({ action: "parse", page: pagina, prop: "wikitext" });
  if (j.error) throw new Error(`wiki API (${pagina}): ${j.error.info}`);
  return j.parse.wikitext["*"];
}

// Tira [[File:...]], <span...>...</span>, '' / ''' de um trecho de wikitext
// e devolve só o texto visível.
function limparWikitexto(s) {
  return s
    .replace(/\[\[File:[^\]]*\]\]/gi, "")
    .replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "")
    .replace(/<hr>/gi, " ")
    .replace(/'''?/g, "")
    .replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

function campoInfobox(bloco, campo) {
  const m = bloco.match(new RegExp(`\\|\\s*${campo}\\s*=([^\\n]*(?:\\n(?!\\s*\\|)[^\\n]*)*)`, "i"));
  return m ? limparWikitexto(m[1]) : "";
}

function parseMoeda(preco) {
  return preco.replace(/\s+/g, " ").trim() || null;
}

function parseDataSolta(txt) {
  if (!txt) return null;
  const s = txt.replace(/^''|''$/g, "").trim();
  if (/tba/i.test(s)) return null;
  const MESES = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const m = s.match(/([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) { const mes = MESES[m[1].slice(0, 3).toLowerCase()]; if (mes != null) return new Date(Date.UTC(+m[3], mes, +m[2])).toISOString().slice(0, 10); }
  return null;
}

function parseSeasonsGreetings(wikitext) {
  const eventos = [];
  const blocos = wikitext.split(/\n(?===+\s*\S)/); // corta em cada == ou === cabeçalho
  let ano = null, regiao = "";
  for (const bloco of blocos) {
    const hAno = bloco.match(/^==\s*(\d{4})\s*==/);
    if (hAno) { ano = hAno[1]; regiao = ""; }
    const hRegiao = bloco.match(/^===\s*(South Korea|Japan)\s*===/i);
    if (hRegiao) regiao = hRegiao[1];

    const infobox = bloco.match(/\{\{Infobox Item([\s\S]*?)\n\}\}/i);
    if (!infobox || !ano) continue;
    const corpo = infobox[1];
    const nomeBruto = campoInfobox(corpo, "name");
    const nome = nomeBruto.replace(new RegExp(`^${ano}\\s*`), "").trim() || `${ano} Season's Greetings`;
    const lancamento = parseDataSolta(campoInfobox(corpo, "released"));
    const editora = campoInfobox(corpo, "editor");
    const distribuidora = campoInfobox(corpo, "distributor");
    const preco = parseMoeda(campoInfobox(corpo, "price"));

    const contM = bloco.match(/'''Contents:'''(?:<\/div>)?\s*\n([\s\S]*?)(?:\n\{\{Clear\}\}|\n==|$)/i);
    const itens = contM ? contM[1].split("\n").map((l) => l.replace(/^\*\s*/, "").trim()).filter(Boolean) : [];

    const notasPartes = [];
    if (editora) notasPartes.push(`editora: ${editora}`);
    if (distribuidora) notasPartes.push(`distribuidora: ${distribuidora}`);
    if (preco) notasPartes.push(`preço: ${preco}`);
    if (itens.length) notasPartes.push(`conteúdo: ${itens.join("; ")}`);

    eventos.push({
      evento: nome,
      tipo: "season's greetings",
      data_inicio: lancamento,
      data_inicio_raw: campoInfobox(corpo, "released") || null,
      data_fim: null, data_fim_raw: null,
      pais: /japan/i.test(regiao) ? "japão" : "coreia",
      cidade: null,
      notas: notasPartes.join(" · ") || null,
      aba_origem: ABA_SG,
    });
  }
  return eventos;
}

// "Jun. 3 - 18, 2023" / "Aug. 23, 2025 - Sep. 3, 2025" etc.: quando um dos
// lados do intervalo não tem ano, usa o último ano de 4 dígitos achado na
// string inteira. Cobre o caso comum; intervalos compostos demais (vários
// anos numa linha só) ficam sem data parseada, mas o texto original sempre
// fica preservado em *_raw.
function parseIntervalo(txt) {
  if (!txt) return [null, null];
  const anosAchados = [...txt.matchAll(/\d{4}/g)].map((m) => m[0]);
  const anoPadrao = anosAchados.length === 1 ? anosAchados[0] : null;
  const partes = txt.split(/\s*-\s*/).map((s) => s.trim());
  const comAno = (s) => (s && !/\d{4}/.test(s) && anoPadrao ? `${s}, ${anoPadrao}` : s);
  return [parseDataSolta(comAno(partes[0])), partes[1] ? parseDataSolta(comAno(partes[1])) : null];
}

function limparLocal(s) {
  return s.replace(/\{\{Flags\|\w+\}\}/gi, "").replace(/<br\s*\/?>/gi, "; ").replace(/\s+/g, " ").trim() || null;
}

function parseMerchEvent(titulo, wikitext) {
  const infobox = wikitext.match(/\{\{Infobox Event([\s\S]*?)\n\}\}/i);
  if (!infobox) return null;
  const corpo = infobox[1];
  const nome = campoInfobox(corpo, "name") || titulo;
  const data = campoInfobox(corpo, "date");
  const local = campoInfobox(corpo, "location");
  const projeto = campoInfobox(corpo, "project");

  const fundoM = wikitext.match(/==\s*Background\s*==\s*\n([\s\S]*?)(?:\n\{\{Clear\}\}|\n==|\{\{Reflist|$)/i);
  const fundo = fundoM ? limparWikitexto(fundoM[1].replace(/<ref>[\s\S]*?<\/ref>/gi, "")).slice(0, 400) : "";

  const [dataInicio, dataFim] = parseIntervalo(data);
  const notasPartes = [];
  if (projeto) notasPartes.push(`projeto: ${projeto}`);
  if (fundo) notasPartes.push(fundo);

  return {
    evento: nome,
    tipo: "pop-up / evento (wiki)",
    data_inicio: dataInicio,
    data_inicio_raw: data || null,
    data_fim: dataFim,
    data_fim_raw: data || null,
    pais: null,
    cidade: limparLocal(local),
    notas: notasPartes.join(" · ") || null,
    aba_origem: ABA_MERCH,
  };
}

// Reutilizável pelo cron (api/cron/sync-eventos.js) além do CLI abaixo.
export async function importarWikiSkz(url, key) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const sgWikitext = await wikitextDe("Season's Greetings");
  const sgEventos = parseSeasonsGreetings(sgWikitext);

  const lista = await apiGet({ action: "query", list: "categorymembers", cmtitle: "Category:Merch events", cmlimit: "100" });
  const titulos = lista.query.categorymembers.map((p) => p.title);
  const merchEventos = [];
  for (const titulo of titulos) {
    const wt = await wikitextDe(titulo);
    const ev = parseMerchEvent(titulo, wt);
    if (ev) merchEventos.push(ev);
  }

  const todos = [...sgEventos, ...merchEventos];

  const del = await fetch(`${url}/rest/v1/catalogo_eventos?aba_origem=in.("${ABA_SG}","${ABA_MERCH}")`, { method: "DELETE", headers });
  if (!del.ok) throw new Error(`Supabase (limpar antes de reimportar): HTTP ${del.status} ${await del.text()}`);

  const r = await fetch(`${url}/rest/v1/catalogo_eventos`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(todos) });
  if (!r.ok) throw new Error(`Supabase (inserir): HTTP ${r.status} ${await r.text()}`);
  return { sg: sgEventos.length, merch: merchEventos.length, merchTotal: titulos.length };
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  const r = await importarWikiSkz(url, key);
  console.log(`Season's Greetings: ${r.sg} edição(ões).`);
  console.log(`Merch events: ${r.merch}/${r.merchTotal} página(s) com Infobox Event reconhecida.`);
  console.log(`\n${r.sg + r.merch} evento(s) gravado(s) em catalogo_eventos.`);
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error("Falhou:", err.message); process.exitCode = 1; });
}

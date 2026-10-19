// Importa a "SKZ Era Timeline" (planilha do Google Sheets mantida por
// terceiros — clemgraces@gmail.com —, compartilhada com a conta da usuária)
// pra tabela catalogo_eventos. Cobre fanclube, pop-up, Season's Greetings,
// merch, collab, turnê, revista etc.: as categorias que o CraftenSKZ não
// tem (esse cobre só álbum e POB, em scripts/sync-catalogo.mjs).
//
// A planilha é de outra pessoa; isso aqui só lê o que está público pra quem
// tem o link (via exportação CSV do Google Sheets, sem precisar de login).
// Pode rodar de novo quando ela atualizar a planilha — cada execução apaga
// as linhas antigas desta fonte e reimporta tudo, pra nunca duplicar.
//
// Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.
//
// Uso: node scripts/migrar-eventos-timeline.mjs

const SHEET_ID = "1-DaPkuhrpA6yHgYjzPXm9ac_L_Uc-1mmIVVKtBb09M8";
// "Pop-Ups" fica de fora de propósito: as 26 páginas de "Category:Merch
// events" da wiki (scripts/migrar-wiki-skz.mjs) cobrem praticamente o
// mesmo conjunto de pop-ups, com mais detalhe (contexto, fonte) e mais
// atualizadas — ter as duas geraria evento duplicado em catalogo_eventos.
// "all activities" continua incluída mesmo tendo linhas tipo "pop-up"
// porque cobre eventos mais antigos que não estão na wiki.
const ABAS = ["all activities", "Tours", "Nacific", "Brand Collabs"];

function parseCSV(texto) {
  const linhas = [];
  let linha = [], campo = "", aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = ""; linhas.push(linha); linha = [];
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((v) => v !== ""));
}

async function buscarAba(nome) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nome)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
  const linhas = parseCSV(await r.text());
  return linhas.slice(1); // tira o cabeçalho
}

const MESES = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseData(txt) {
  if (!txt) return null;
  const s = String(txt).trim().replace(",", "").replace(/\s+/g, " ");
  let m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})\s+(\d{4})$/); // "Dec 29 2017" / "March 18 2020"
  if (m) { const mes = MESES[m[1].slice(0, 3).toLowerCase()]; if (mes != null) return new Date(Date.UTC(+m[3], mes, +m[2])).toISOString().slice(0, 10); }
  m = s.match(/^([A-Za-z]+)\s+(\d{4})$/); // "Sep 2021" (sem dia — vira dia 1)
  if (m) { const mes = MESES[m[1].slice(0, 3).toLowerCase()]; if (mes != null) return new Date(Date.UTC(+m[2], mes, 1)).toISOString().slice(0, 10); }
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/); // "210906" (AAMMDD, usado na aba Nacific)
  if (m) return new Date(Date.UTC(2000 + +m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10);
  return null; // ex.: "Nov 10" sem ano, ou vazio — fica null; o texto original vai pro *_raw
}

function linhaEvento({ evento, tipo, dataInicio, dataFim, pais, cidade, notas, aba }) {
  if (!evento) return null;
  return {
    evento: evento.trim(),
    tipo: (tipo || "").trim() || null,
    data_inicio: parseData(dataInicio),
    data_inicio_raw: (dataInicio || "").trim() || null,
    data_fim: parseData(dataFim),
    data_fim_raw: (dataFim || "").trim() || null,
    pais: (pais || "").trim() || null,
    cidade: (cidade || "").trim() || null,
    notas: (notas || "").trim() || null,
    aba_origem: aba,
  };
}

function transformar(aba, linhas) {
  if (aba === "all activities") return linhas.map(([data, activity, tipo, pais]) =>
    linhaEvento({ evento: activity, tipo, dataInicio: data, pais, aba }));
  if (aba === "Tours") return linhas.map(([evento, data, cidade, pais]) =>
    linhaEvento({ evento, tipo: "tour", dataInicio: data, pais, cidade, aba }));
  if (aba === "Nacific") return linhas.map(([round, data, pcEvent, , dataVid, nome, pcRounds]) =>
    linhaEvento({
      evento: nome || pcEvent || round, tipo: "collab: nacific", dataInicio: dataVid || data,
      notas: [pcEvent && `pc event: ${pcEvent}`, round, pcRounds && `pc round(s): ${pcRounds}`].filter(Boolean).join(" · "),
      aba,
    }));
  if (aba === "Brand Collabs") return linhas.map(([brand, inicio, fim]) =>
    linhaEvento({ evento: brand, tipo: "brand collab", dataInicio: inicio, dataFim: fim, aba }));
  if (aba === "Pop-Ups") return linhas.map(([inicio, evento, fim, cidade, pais]) =>
    linhaEvento({ evento, tipo: "pop-up", dataInicio: inicio, dataFim: fim, pais, cidade, aba }));
  return [];
}

// Reutilizável pelo cron (api/cron/sync-eventos.js) além do CLI abaixo.
export async function importarEventosTimeline(url, key) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  let eventos = [];
  for (const aba of ABAS) {
    const linhas = await buscarAba(aba);
    const novos = transformar(aba, linhas).filter(Boolean);
    eventos.push(...novos);
  }

  const del = await fetch(`${url}/rest/v1/catalogo_eventos?aba_origem=in.(${ABAS.map((a) => `"${a}"`).join(",")})`, {
    method: "DELETE", headers,
  });
  if (!del.ok) throw new Error(`Supabase (limpar antes de reimportar): HTTP ${del.status} ${await del.text()}`);

  const lote = 500;
  for (let i = 0; i < eventos.length; i += lote) {
    const parte = eventos.slice(i, i + lote);
    const r = await fetch(`${url}/rest/v1/catalogo_eventos`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(parte),
    });
    if (!r.ok) throw new Error(`Supabase (inserir): HTTP ${r.status} ${await r.text()}`);
  }
  return eventos.length;
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  const total = await importarEventosTimeline(url, key);
  console.log(`${total} evento(s) gravado(s) em catalogo_eventos.`);
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error("Falhou:", err.message); process.exitCode = 1; });
}

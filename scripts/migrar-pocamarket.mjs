// Preço e link dos itens da banda Stray Kids à venda na POCA MALL
// (mall.pocamarket.com) pra tabela catalogo_loja. É o site onde a usuária
// compra; ela pediu preço/link automático, mas só do que é da Stray Kids.
//
// A busca do site (/en/search?q=...) é renderizada no servidor (Next.js App
// Router, RSC) e já embute os dados do produto como JSON dentro de chamadas
// `self.__next_f.push([id, "...payload..."])` no HTML — não precisa de
// navegador. Cada payload é ele mesmo uma string JSON válida (é assim que o
// Next serializa o chunk), então dá pra pegar com JSON.parse em vez de
// tentar desescapar aspas na mão. Depois disso o texto já vem limpo, e
// filtramos por "brand":"Stray Kids" nesse texto (não pelo motor de busca
// deles, pra não depender de ele achar tudo pelo nome).
//
// Roda de novo sempre que quiser atualizar preço/disponibilidade: apaga e
// reimporta tudo (é um retrato do catálogo agora, não um histórico — item
// que saiu de linha simplesmente some da tabela).
//
// Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.
//
// Uso: node scripts/migrar-pocamarket.mjs

const BUSCA = "https://mall.pocamarket.com/en/search?q=Stray%20Kids";

function decodeUnicode(s) {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function campo(janela, nome, tipo) {
  if (tipo === "num") { const m = janela.match(new RegExp(`"${nome}":(\\d+)`)); return m ? Number(m[1]) : null; }
  if (tipo === "strOrNull") {
    const m = janela.match(new RegExp(`"${nome}":(null|"((?:[^"\\\\]|\\\\.)*)")`));
    if (!m) return null;
    return m[1] === "null" ? null : decodeUnicode(m[2]);
  }
  const m = janela.match(new RegExp(`"${nome}":"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? decodeUnicode(m[1]) : null;
}

// Devolve o texto já desescapado de todo chunk RSC que mencione a marca,
// juntando tudo num texto só pra procurar os produtos.
function chunksComMarca(html) {
  const re = /self\.__next_f\.push\((\[[\s\S]*?\])\)/g;
  let m, textos = [];
  while ((m = re.exec(html))) {
    let arr;
    try { arr = JSON.parse(m[1]); } catch { continue; }
    const payload = typeof arr[1] === "string" ? arr[1] : "";
    if (payload.includes("\"brand\":\"Stray Kids\"")) textos.push(payload);
  }
  return textos.join("\n");
}

// Reutilizável pelo cron (api/cron/sync-eventos.js) além do CLI abaixo.
export async function buscarPocamarketStrayKids() {
  const r = await fetch(BUSCA, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`POCA MALL: HTTP ${r.status}`);
  const texto = chunksComMarca(await r.text());

  const idRe = /"id":"([0-9a-f-]+)","brand":"Stray Kids"/g;
  const vistos = new Set();
  const itens = [];
  let m;
  while ((m = idRe.exec(texto))) {
    if (vistos.has(m[1])) continue;
    vistos.add(m[1]);
    const janela = texto.slice(m.index, m.index + 900);
    const precoCents = campo(janela, "priceCents", "num");
    const precoListaCents = campo(janela, "listPriceCents", "num");
    const slug = campo(janela, "slug");
    itens.push({
      id: m[1],
      nome: campo(janela, "name"),
      preco_usd: precoCents != null ? precoCents / 100 : null,
      preco_lista_usd: precoListaCents != null ? precoListaCents / 100 : null,
      slug,
      link: slug ? `https://mall.pocamarket.com/en/products/${slug}` : null,
      imagem: campo(janela, "imageUrl"),
      categoria: campo(janela, "categoryName"),
      pre_order_em: campo(janela, "preorderReleaseAt", "strOrNull"),
    });
  }
  return itens;
}

export async function importarPocamarket(url, key) {
  const itens = await buscarPocamarketStrayKids();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const del = await fetch(`${url}/rest/v1/catalogo_loja?fonte=eq.pocamarket`, { method: "DELETE", headers });
  if (!del.ok) throw new Error(`Supabase (limpar antes de reimportar): HTTP ${del.status} ${await del.text()}`);

  if (itens.length) {
    const linhas = itens.map((i) => ({ ...i, fonte: "pocamarket" }));
    const r = await fetch(`${url}/rest/v1/catalogo_loja`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(linhas),
    });
    if (!r.ok) throw new Error(`Supabase (inserir): HTTP ${r.status} ${await r.text()}`);
  }
  return itens.length;
}

async function main() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  const total = await importarPocamarket(url, key);
  console.log(`${total} item(ns) da Stray Kids gravado(s) em catalogo_loja.`);
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error("Falhou:", err.message); process.exitCode = 1; });
}

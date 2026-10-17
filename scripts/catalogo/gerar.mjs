// Gera o colecao.json juntando todas as fontes de photocards.
//
//   node scripts/catalogo/gerar.mjs
//
// - Cada card guarda de quais fontes veio (campo f).
// - Quando duas fontes têm o mesmo card (mesma era, versão e membro), vira um só.
// - A foto escolhida é a de maior resolução entre as fontes e a folha de fotos
//   antiga (blobs/). Das fontes, guardamos só o link; nada é copiado.
// - Os códigos dos cards (campo i) nunca mudam, porque as marcações de
//   tenho/quero e os pedidos ligados apontam pra eles.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { medir, emLotes, dimensoes } from "./imagem.mjs";
import * as craftenskz from "./fontes/craftenskz.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAIDA = path.join(RAIZ, "colecao.json");
const CACHE = path.join(RAIZ, "scripts/catalogo/imagens.json");

// Ordem = prioridade dos dados (era, versão, tipo) quando duas fontes discordam.
const FONTES = [craftenskz];

// Abaixo disso a foto é considerada ruim (o card fica marcado e pede foto melhor).
const LARGURA_BOA = 300;

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const chave = c => `${norm(c.era)}|${norm(c.versao)}|${norm(c.membro)}`;

const antigo = JSON.parse(fs.readFileSync(SAIDA, "utf8"));
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};

// Largura de cada quadradinho da folha de fotos antiga, lida do próprio arquivo.
const larguraFolha = {};
for (const [i, u] of antigo.sheets.entries()) {
  const arq = path.join(RAIZ, "blobs", u.replace("/_blob/", "") + ".jpg");
  const d = fs.existsSync(arq) ? dimensoes(fs.readFileSync(arq).subarray(0, 65536)) : null;
  larguraFolha[i] = d ? Math.floor(d.w / antigo.n) : 0;
}

const porId = new Map(antigo.items.map(x => [x.i, { ...x, f: [], imgs: [] }]));
const porChave = new Map([...porId.values()].map(x => [chave({ era: x.e, versao: x.v, membro: x.m }), x]));
const fontes = {};

for (const F of FONTES) {
  const { cards, atualizado } = await F.buscar();
  fontes[F.fonte.id] = { nome: F.fonte.nome, site: F.fonte.site, atualizado: atualizado && atualizado.toISOString().slice(0, 10), cards: cards.length };
  for (const c of cards) {
    let it = porId.get(c.id) || porChave.get(chave(c));
    if (!it) {
      it = { i: c.id, m: c.membro, e: c.era, o: c.origem, t: c.tipo, v: c.versao, s: c.set, f: [], imgs: [] };
      porId.set(it.i, it);
      porChave.set(chave(c), it);
    }
    if (!it.f.includes(F.fonte.id)) it.f.push(F.fonte.id);
    it.imgs.push(...c.imagens);
  }
}

// Mede as fotos que ainda não estão no cache, e tenta de novo as que não existiam
// (a fonte pode ter publicado a foto depois).
const faltam = [...new Set([...porId.values()].flatMap(x => x.imgs))].filter(u => !cache[u]);
console.log(`medindo ${faltam.length} fotos novas (${Object.keys(cache).length} já no cache)`);
await emLotes(faltam, 8, async u => {
  try { cache[u] = await medir(u); } catch (e) { console.warn("não medi", u, e.message); }
});

let comFoto = 0, ruins = 0, melhoradas = 0;
const items = [...porId.values()].map(it => {
  const { imgs, ...out } = it;
  const folha = out.p ? larguraFolha[out.p[0]] : 0;
  const melhor = imgs.map(u => ({ u, ...(cache[u] || {}) })).filter(x => x.w).sort((a, b) => b.w - a.w)[0];
  delete out.u; delete out.w;
  if (melhor && melhor.w > folha) {
    out.u = melhor.u; out.w = melhor.w;
    if (folha) melhoradas++;
  } else if (folha) out.w = folha;
  if (out.u || out.p) comFoto++;
  if ((out.u || out.p) && out.w < LARGURA_BOA) ruins++;
  if (!out.f.length) delete out.f;
  return out;
});

const resumo = Object.values(fontes).map(f => `${f.nome}, atualizado em ${f.atualizado ? f.atualizado.split("-").reverse().join("/") : "?"}`).join("; ");
const novo = { ...antigo, fonte: resumo, fontes, items };
fs.writeFileSync(SAIDA, JSON.stringify(novo));
fs.writeFileSync(CACHE, JSON.stringify(Object.fromEntries(Object.entries(cache).sort()), null, 0));
console.log(`${items.length} cards · ${comFoto} com foto · ${melhoradas} com foto melhor que a antiga · ${ruins} com foto abaixo de ${LARGURA_BOA}px`);

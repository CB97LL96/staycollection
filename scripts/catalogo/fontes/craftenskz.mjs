// Fonte: CraftenSKZ / StrayKidsPCCollector (checklist feito por fã, dados abertos).
// Álbuns coreanos e japoneses e POBs coreanos, com membro, álbum, versão e foto.
import { UA } from "../imagem.mjs";

const BASE = "https://craftenskz.github.io/StrayKidsPCCollector/";
const CATEGORIAS = ["korean_albums", "japanese_albums", "korean_pob", "japanese_pob"];

export const fonte = { id: "craftenskz", nome: "CraftenSKZ", site: BASE };

// Mesmas regras do catálogo do protótipo (VC e offline contam como POB).
function tipo(categoria, versao) {
  if (categoria.endsWith("_albums")) return "Álbum";
  const v = versao.toLowerCase();
  if (/\b(ld|lucky ?draw)\b/.test(v)) return "Lucky draw";
  if (/fan ?sign|fancall|video ?call|fsg/.test(v)) return "Fansign / fancall";
  if (/broadcast|music show|showcase/.test(v)) return "Broadcast";
  if (/stream/.test(v)) return "Streaming event";
  return "POB";
}

export async function buscar() {
  const cards = [];
  let atualizado = null;
  for (const cat of CATEGORIAS) {
    const r = await fetch(`${BASE}data/${cat}.json`, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`CraftenSKZ ${cat}: ${r.status}`);
    const lm = r.headers.get("last-modified");
    if (lm && (!atualizado || new Date(lm) > atualizado)) atualizado = new Date(lm);
    for (const x of await r.json()) {
      // "underconstruction" é um aviso do site, não um card.
      if (!x.id || x.id === "underconstruction" || !x.album) continue;
      const pasta = x.id.split("-")[0];
      cards.push({
        id: x.id,
        membro: String(x.member || "").trim(),
        era: String(x.album).trim(),
        origem: cat.startsWith("japanese") ? "JP" : "KR",
        tipo: tipo(cat, String(x.name || "")),
        versao: String(x.name || "").trim(),
        set: String(x.set || ""),
        imagens: [`${BASE}assets/images/photocards/${cat}/${pasta}/${x.id}.webp`],
      });
    }
  }
  return { cards, atualizado };
}

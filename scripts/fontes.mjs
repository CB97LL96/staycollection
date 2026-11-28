import { abrirStore } from "./v2/store.mjs";
// Carimbo de "quando cada fonte foi lida pela última vez". Fica no documento
// meta/fontes (coleção "meta") e o app mostra no topo da tela, pra Lari saber
// o quanto os dados estão atualizados. Nunca derruba quem chamou: se falhar,
// só registra no log.
//
// fonte: "planilhas" | "paboracha" | "catalogo" | "bot" | "whatsapp"
// info:  { nota?, ate?, erro? }   erro = a tentativa falhou (mantém o "em" antigo)
export async function marcarFonte(url, key, ownerId, fonte, info = {}) {
  try {
    if (!url || !key || !ownerId) return;
    const s = abrirStore({ url, key, owner: ownerId });
    const atual = (await s.pegar("meta", "fontes").catch(() => null)) || {};
    const agora = new Date().toISOString();
    atual[fonte] = info.erro
      ? { ...(atual[fonte] || {}), tentouEm: agora, erro: String(info.erro).slice(0, 200) }
      : { ...(atual[fonte] || {}), em: agora, tentouEm: agora, erro: null, nota: info.nota || "", ...(info.ate ? { ate: info.ate } : {}) };
    await s.gravar("meta", "fontes", atual);
  } catch (e) { console.error("fontes:", e.message); }
}

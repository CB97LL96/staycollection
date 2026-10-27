// Carimbo de "quando cada fonte foi lida pela última vez". Fica no documento
// meta/fontes (coleção "docs") e o app mostra no topo da tela, pra Lari saber
// o quanto os dados estão atualizados. Nunca derruba quem chamou: se falhar,
// só registra no log.
//
// fonte: "planilhas" | "paboracha" | "catalogo" | "bot" | "whatsapp"
// info:  { nota?, ate?, erro? }   erro = a tentativa falhou (mantém o "em" antigo)
export async function marcarFonte(url, key, ownerId, fonte, info = {}) {
  try {
    if (!url || !key || !ownerId) return;
    const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const r = await fetch(`${url}/rest/v1/docs?owner=eq.${ownerId}&col=eq.meta&id=eq.fontes&select=data`, { headers });
    const atual = r.ok ? ((await r.json())[0] || {}).data || {} : {};
    const agora = new Date().toISOString();
    atual[fonte] = info.erro
      ? { ...(atual[fonte] || {}), tentouEm: agora, erro: String(info.erro).slice(0, 200) }
      : { ...(atual[fonte] || {}), em: agora, tentouEm: agora, erro: null, nota: info.nota || "", ...(info.ate ? { ate: info.ate } : {}) };
    const w = await fetch(`${url}/rest/v1/docs?on_conflict=owner,col,id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ owner: ownerId, col: "meta", id: "fontes", data: atual }),
    });
    if (!w.ok) console.error("fontes: HTTP", w.status, await w.text());
  } catch (e) { console.error("fontes:", e.message); }
}

// Service worker mínimo: deixa instalar o app no celular e recebe o
// compartilhamento do WhatsApp (texto e prints). Não guarda nada do app em cache.
const CACHE = "compartilhado";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method === "POST" && u.pathname === "/compartilhar") {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const c = await caches.open(CACHE);
        for (const k of await c.keys()) await c.delete(k);
        const texto = [fd.get("title"), fd.get("text"), fd.get("url")].filter(Boolean).join("\n");
        if (texto) await c.put("/_c/texto", new Response(texto));
        let i = 0;
        for (const f of fd.getAll("arquivos")) {
          if (f && f.size) await c.put("/_c/arq/" + i++, new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream", "X-Nome": encodeURIComponent(f.name || "") } }));
        }
      } catch (err) { /* abre o app mesmo assim */ }
      return Response.redirect("/?c=1", 303);
    })());
  }
});

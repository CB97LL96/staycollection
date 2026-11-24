// Testa o compartilhar do WhatsApp: service worker, cache, investigação e resultado.
// NODE_PATH=/opt/node-tools/node_modules node scripts/e2e/compartilhar.cjs
const { chromium } = require("playwright");
const fs = require("fs"), http = require("http"), path = require("path");
const root = path.join(__dirname, "..", "..");
const tipos = { ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(root, p); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": tipos[path.extname(f)] || "application/javascript" }); r.end(b); }); }).listen(0);
(async () => {
  const base = `http://127.0.0.1:${srv.address().port}`, b = await chromium.launch(), out = [];
  const ok = (c, m) => { out.push((c ? "ok   " : "FALHA ") + m); if (!c) process.exitCode = 1; };
  const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  ok(m.share_target && m.share_target.action === "/compartilhar" && m.share_target.params.files[0].name === "arquivos", "manifest tem share_target com texto e imagens");
  ok(m.icons.every((i) => fs.existsSync(path.join(root, i.src))), "ícones do manifest existem");
  const ctx = await b.newContext({ viewport: { width: 400, height: 800 } }); const pg = await ctx.newPage();
  const erros = []; pg.on("pageerror", (e) => erros.push(e.message));
  await pg.route("**/backend.js", (r) => r.fulfill({ body: "" })); await pg.route("**/@supabase/**", (r) => r.fulfill({ body: "" })); await pg.route("**/fonts.g*/**", (r) => r.abort());
  let corpo = null;
  await pg.route("**/api/investigar", async (r) => { corpo = JSON.parse(r.request().postData()); await new Promise((x) => setTimeout(x, 200)); r.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "app-x", resumo: "frete liberado", ceg: { id: "g1", nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi", ondeOlhar: "Avisos", planilha: { abas: ["Frete"], erro: "" } }, totalDevido: 18.4, semValor: 0, candidatas: [], pergunta: "", registros: [{ destino: "cobrancas", acao: "nova", referente: "frete inter", tipo: "Frete internacional", valor: 18.4, comunidade: "Comunidade Azul", ceg: "Caixa 2 PHP", confianca: "alta", trecho: "frete inter 18,40", duvidas: "", estado: "pendente" }] }) }); });
  await pg.route("**/api/print", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ resumo: "tabela", cards: [{ caixa: [100, 50, 600, 250], tipo: "photocard", membro: "HAN", nome: "Aladin", numero: "26", legivel: true }] }) }));
  await pg.addInitScript({ path: path.join(__dirname, "banco-falso.js") });
  await pg.goto(base + "/"); await pg.waitForSelector(".app, #main");
  await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForFunction(() => navigator.serviceWorker.controller);
  ok(true, "service worker registrado e controlando a página");

  // 1) texto compartilhado do WhatsApp
  await pg.evaluate(async () => { const fd = new FormData(); fd.append("text", "Caixa 2 PHP: frete inter liberado, 18,40"); await fetch("/compartilhar", { method: "POST", body: fd }); });
  await pg.goto(base + "/?c=1"); await pg.waitForSelector(".origem", { timeout: 8000 });
  ok(corpo && corpo.texto.includes("frete inter liberado"), "o texto compartilhado chegou na investigação");
  const origem = await pg.locator(".origem").innerText();
  ok(/comunidade azul/i.test(origem) && /GOM Gabi/.test(origem), `a GOM aparece com a comunidade (${origem.replace(/\n/g, " | ")})`);
  ok(await pg.locator(".origem .av, .origem [class*=av]").count() > 0, "ícone da comunidade ao lado da GOM");
  ok((await pg.locator("#shB").innerText()).includes("18,40"), "mostra quanto deve na CEG");
  ok(!(await pg.url()).includes("c=1"), "a URL volta ao normal");
  await pg.evaluate(() => { window.__store.caixa.set("app-x", { origem: "whatsapp", estado: "lida", registros: [{ destino: "cobrancas", acao: "nova", referente: "frete inter", tipo: "Frete internacional", valor: 18.4, comunidade: "Comunidade Azul", ceg: "Caixa 2 PHP", confianca: "alta", estado: "pendente", trecho: "x" }] }); window.__fire("caixa"); });
  await pg.waitForSelector('[data-cxa="aceitar"]:not([disabled])');
  await pg.click('[data-cxa="aceitar"]'); await pg.waitForTimeout(400);
  const cob = await pg.evaluate(() => [...window.__store.cobrancas.values()].find((c) => c.referente === "frete inter"));
  ok(cob && cob.valor === 18.4 && cob.status === "Pendente" && !("pix" in cob), "aceitar cria a cobrança, sem pix");

  // 2) imagem compartilhada: pergunta o que é e abre o colar print
  const png = fs.readFileSync(path.join(__dirname, "print.png")).toString("base64");
  await pg.evaluate(async (b64) => { const fd = new FormData(); fd.append("arquivos", new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "print.png", { type: "image/png" })); await fetch("/compartilhar", { method: "POST", body: fd }); }, png);
  await pg.goto(base + "/?c=1"); await pg.waitForSelector("[data-shesc]");
  ok(await pg.locator("[data-shesc]").count() === 2, "imagem compartilhada pergunta o que é");
  await pg.click('[data-shesc="cards"]'); await pg.waitForSelector(".prrow", { timeout: 8000 });
  ok(await pg.locator(".prrow").count() === 1, "escolher 'cards' abre o colar print com o card achado");
  ok(erros.length === 0, "sem erro no console " + erros.join(" | "));
  console.log(out.join("\n")); await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });

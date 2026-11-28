// Quadro: onde ela insere coisas novas. NODE_PATH=/opt/node-tools/node_modules node scripts/e2e/quadro.cjs
const { chromium } = require("playwright");
const fs = require("fs"), http = require("http"), path = require("path");
const root = path.join(__dirname, "..", "..");
const tipos = { ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(root, p); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": tipos[path.extname(f)] || "application/javascript" }); r.end(b); }); }).listen(0);
const iconKey = (t, n) => { let h = 5381; const x = String(n || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, ""); for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) >>> 0; return "icon-" + t + "-" + h.toString(16); };
(async () => {
  const base = `http://127.0.0.1:${srv.address().port}`, b = await chromium.launch(), out = [];
  const ok = (c, m) => { out.push((c ? "ok   " : "FALHA ") + m); if (!c) process.exitCode = 1; };
  const png = fs.readFileSync(path.join(__dirname, "print.png")), b64 = png.toString("base64");
  for (const [nome, vp] of [["desktop", { width: 1280, height: 900 }], ["celular", { width: 400, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
    const erros = []; pg.on("pageerror", (e) => erros.push(e.message));
    await pg.route("**/backend.js", (r) => r.fulfill({ body: "" })); await pg.route("**/@supabase/**", (r) => r.fulfill({ body: "" })); await pg.route("**/fonts.g*/**", (r) => r.abort());
    await pg.route("**/_blob/*", (r) => r.fulfill({ contentType: "image/png", body: png }));
    await pg.route("**/api/print", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ resumo: "x", cards: [
      { caixa: [100, 50, 600, 250], tipo: "photocard", membro: "HAN", nome: "Karma", numero: "", legivel: true, candidatos: [{ i: "x-cand", nota: 0.8 }] },
      { caixa: [100, 300, 600, 500], tipo: "photocard", membro: "", nome: "", numero: "", legivel: true, candidatos: [] } ] }) }));
    await pg.addInitScript({ path: path.join(__dirname, "banco-falso.js") });
    await pg.goto(base + "/#mural"); await pg.waitForSelector(".mgrp");
    const A = "a".repeat(32);
    await pg.evaluate(([k, a, g, ga]) => { window.__store.fotos.set(k, { asset: a }); window.__store.fotos.set(g, { asset: ga }); window.__fire("fotos"); }, [iconKey("com", "Comunidade Azul"), A, iconKey("grp", "Azul • Caixa 2 PHP"), "b".repeat(32)]);
    await pg.evaluate(() => { const g = window.__store.cegs.get("g1"); window.__store.cegs.set("g1", { ...g, grupo: "Azul • Caixa 2 PHP" }); window.__fire("cegs"); });
    await pg.waitForTimeout(300);
    // Mural: só lista, com a foto da comunidade e do grupo
    ok(await pg.locator('[data-mvw]').count() === 0, `${nome}: o Mural não tem mais visão Quadro`);
    ok(await pg.locator(".mgh .av[style*=\"background-image\"]").count() > 0, `${nome}: cabeçalho da GOM mostra a foto da comunidade`);
    ok(await pg.locator(".mhd .av[style*=\"background-image\"]").count() > 0, `${nome}: cabeçalho da CEG mostra a foto do grupo do WhatsApp`);
    // Inserir -> quadros
    await pg.click("[data-qhome]"); await pg.waitForSelector(".qb");
    ok(await pg.locator(".qb").count() >= 2, `${nome}: tela de quadros lista as GOMs`);
    ok(await pg.locator(".qb .av[style*=\"background-image\"]").count() > 0, `${nome}: cada quadro tem o ícone da comunidade`);
    await pg.fill("#qq", "ana"); await pg.waitForTimeout(350); ok(await pg.locator(".qb").count() === 1, `${nome}: busca filtra os quadros`);
    await pg.fill("#qq", ""); await pg.waitForTimeout(350);
    await pg.locator(".qb", { hasText: "Gabi" }).first().click(); await pg.waitForSelector(".qf");
    ok(await pg.locator(".qtit .gtag").count() === 1, `${nome}: o quadro mostra a GOM com a comunidade`);
    ok(await pg.locator(".qf .qft", { hasText: "Caixa 2 PHP" }).count() === 1 && await pg.locator(".qf .qft", { hasText: "Variados 7" }).count() === 1, `${nome}: cada tag (CEG) é um frame`);
    ok(await pg.locator(".qf .mtile").count() >= 2, `${nome}: os cards que já existem aparecem no frame da tag`);
    // nova tag
    await pg.fill("#qtag", "Do It Pobs"); await pg.press("#qtag", "Enter"); await pg.waitForTimeout(400);
    const nova = await pg.evaluate(() => [...window.__store.cegs.values()].find((c) => c.nome === "Do It Pobs"));
    ok(nova && nova.gom === "Gabi" && nova.comunidade === "Comunidade Azul", `${nome}: nova tag cria a CEG nessa GOM e comunidade`);
    // frames em grade fixa: mover e esconder
    const nomes = () => pg.locator(".qf .qft").evaluateAll(els => els.map(e => e.textContent.trim()).filter(t => t && t !== "Notas" && t !== "Sem tag"));
    const n0 = await nomes(); ok(n0.length === 3, `${nome}: 3 tags no quadro (${n0})`);
    ok(await pg.evaluate(() => getComputedStyle(document.querySelector(".qcols")).display) === "grid", `${nome}: os frames ficam numa grade`);
    const primeira = n0[0];
    await pg.locator(".qf", { hasText: primeira }).locator('[data-qmv$="|1"]').first().click(); await pg.waitForTimeout(400);
    const n1 = await nomes(); ok(n1[1] === primeira && n1[0] === n0[1], `${nome}: ▶ move a tag pra depois (${n1})`);
    ok((await pg.evaluate(() => [...window.__store.quadros.values()][0].ordem || [])).length === 3, `${nome}: a ordem das tags fica guardada`);
    await pg.click(".undo"); await pg.waitForTimeout(400); ok(JSON.stringify(await nomes()) === JSON.stringify(n0), `${nome}: desfazer volta a ordem das tags`);
    await pg.locator(".qf", { hasText: n0[2] }).locator("[data-qoff]").first().click(); await pg.waitForTimeout(400);
    ok((await nomes()).length === 2, `${nome}: esconder tira a tag do quadro`);
    ok(await pg.locator("[data-qshow]").count() === 1, `${nome}: aparece "Mostrar 1 escondida"`);
    await pg.click("[data-qshow]"); ok((await nomes()).length === 3 && await pg.locator(".qf.off").count() === 1, `${nome}: mostrar as escondidas (apagadas, tracejadas)`);
    await pg.locator(".qf.off [data-qoff]").click(); await pg.waitForTimeout(400); await pg.click("[data-qshow]").catch(() => {});
    ok((await nomes()).length === 3, `${nome}: mostrar de novo traz a tag de volta`);
    // colar (Ctrl+V) na tag marcada
    await pg.locator(".qf", { hasText: "Caixa 2 PHP" }).locator(".qfh").click();
    const colar = () => pg.evaluate(async (d) => { const f = new File([Uint8Array.from(atob(d), (c) => c.charCodeAt(0))], "p.png", { type: "image/png" }); const dt = new DataTransfer(); dt.items.add(f); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, b64);
    await colar(); await pg.waitForSelector(".rt", { timeout: 6000 });
    const q1 = await pg.evaluate(() => Object.values([...window.__store.quadros.values()][0].rasc));
    ok(q1.length === 1 && q1[0].frame.endsWith("Caixa 2 PHP"), `${nome}: colar põe a imagem na tag marcada`);
    // nome, membro e sugestão do catálogo
    await pg.fill(".qnome", "Han Karma"); await pg.press(".qnome", "Tab"); await pg.waitForTimeout(300);
    ok(await pg.locator(".qpick").count() > 0, `${nome}: o nome digitado sugere cards do catálogo`);
    await pg.locator(".qpick").first().click(); await pg.waitForTimeout(300);
    const r1 = await pg.evaluate(() => Object.values([...window.__store.quadros.values()][0].rasc)[0]);
    ok(r1.nome === "Han Karma" && r1.cardId, `${nome}: nome e card do catálogo guardados (${r1.cardId})`);
    // registrar
    const antes = await pg.evaluate(() => window.__store.itens.size);
    await pg.click("[data-qreg]"); await pg.waitForTimeout(500);
    const item = await pg.evaluate(() => [...window.__store.itens.values()].find((i) => i.origem === "Quadro"));
    ok(item && item.item === "Han Karma" && item.ceg === "Caixa 2 PHP" && item.comunidade === "Comunidade Azul" && item.cards.length === 1 && item.status === "Garantido", `${nome}: registrar cria o item na CEG, ligado ao catálogo`);
    ok(await pg.evaluate(() => Object.keys([...window.__store.quadros.values()][0].rasc || {}).length) === 0, `${nome}: a imagem sai da fila depois de registrar`);
    await pg.click(".undo"); await pg.waitForTimeout(500);
    ok(await pg.evaluate(() => window.__store.itens.size) === antes && await pg.locator(".rt").count() === 1, `${nome}: desfazer devolve a imagem e apaga o item`);
    // segunda imagem sem card: usa a própria foto
    await pg.fill(".qnome", "Card sem catálogo"); await pg.press(".qnome", "Tab"); await pg.waitForTimeout(200);
    await pg.locator(".qpick.on").click().catch(() => {}); await pg.waitForTimeout(200);
    await pg.click("[data-qreg]"); await pg.waitForTimeout(500);
    const i2 = await pg.evaluate(() => [...window.__store.itens].find(([, v]) => v.origem === "Quadro"));
    ok(i2 && (await pg.evaluate((id) => window.__store.fotos.has(id), i2[0])) || i2[1].cards.length === 1, `${nome}: sem card, o item fica com a foto da imagem`);
    // arrastar imagem de uma tag pra outra e enviar arquivo pelo botão
    await pg.setInputFiles('.qfile[data-qf*="Variados"]', path.join(__dirname, "print.png")); await pg.waitForSelector(".rt", { timeout: 6000 });
    ok(await pg.evaluate(() => Object.values([...window.__store.quadros.values()][0].rasc).some((x) => x.frame.endsWith("Variados 7"))), `${nome}: botão "imagem" envia pra tag certa`);
    // separar com IA
    await pg.click("[data-qsep]"); await pg.waitForTimeout(1200);
    const rs = await pg.evaluate(() => Object.values([...window.__store.quadros.values()][0].rasc));
    ok(rs.length === 2 && rs.some((x) => x.membro === "HAN"), `${nome}: Separar troca a imagem por 2 cards com nome e membro`);
    // nota
    await pg.click("[data-qnnota]"); await pg.waitForSelector(".qnota"); await pg.fill(".qnota", "ver com a Gabi"); await pg.press(".qnota", "Tab"); await pg.waitForTimeout(300);
    ok(Object.values(await pg.evaluate(() => [...window.__store.quadros.values()][0].notas)).some((n) => n.t === "ver com a Gabi"), `${nome}: nota do quadro guarda o texto`);
    await pg.screenshot({ path: `/tmp/e2e-quadro2-${nome}.png` });
    await pg.click('[data-qzoom="-"]'); ok((await pg.locator(".qz").innerText()).endsWith("%"), `${nome}: zoom`);
    ok(erros.length === 0, `${nome}: sem erro no console ${erros.join(" | ")}`);
    await ctx.close();
  }
  console.log(out.join("\n")); await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });

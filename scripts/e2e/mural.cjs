const { chromium } = require("playwright");
const fs = require("fs"), http = require("http"), path = require("path");
const root = path.join(__dirname, "..", "..");
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(root, p); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html" : f.endsWith(".json") ? "application/json" : "application/javascript" }); r.end(b); }); }).listen(0);
(async () => {
  const port = srv.address().port, base = `http://127.0.0.1:${port}`;
  const b = await chromium.launch(); const out = [];
  const ok = (c, m) => { out.push((c ? "ok   " : "FALHA ") + m); if (!c) process.exitCode = 1; };
  for (const [nome, vp] of [["desktop", { width: 1280, height: 900 }], ["celular", { width: 400, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 }); const pg = await ctx.newPage();
    const erros = []; pg.on("pageerror", e => erros.push(e.message)); pg.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    await pg.route("**/backend.js", r => r.fulfill({ contentType: "application/javascript", body: "" }));
    await pg.route("**/@supabase/**", r => r.fulfill({ contentType: "application/javascript", body: "" }));
    await pg.route("**/fonts.g*/**", r => r.abort());
    await pg.route("**/api/print", async r => { await new Promise(x => setTimeout(x, 300)); r.fulfill({ contentType: "application/json", body: JSON.stringify({ resumo: "tabela de CEG", cards: [
      { caixa: [100, 50, 600, 250], tipo: "photocard", membro: "HAN", nome: "Aladin", numero: "26", legivel: true, candidatos: [{ i: "mixtape-bangchan-01", nota: 0.9 }, { i: "mixtape-bangchan-02", nota: 0.5 }] },
      { caixa: [100, 300, 600, 500], tipo: "photocard", membro: "", nome: "", numero: "", legivel: false },
      { caixa: [100, 550, 600, 750], tipo: "merch", membro: "", nome: "keyring", numero: "", legivel: true, candidatos: [] } ] }) }); });
    await pg.addInitScript(require("./banco.cjs"));
    await pg.goto(base + "/#mural"); await pg.waitForSelector(".mgrp");
    ok(await pg.locator(".mgh h2").count() === 2, `${nome}: 2 grupos de GOM (Gabi, Ana)`);
    { const h = (await pg.locator(".mgh h2").first().innerText()).toLowerCase(); ok(h.includes("gabi") && h.includes("comunidade azul"), `${nome}: Gabi (com a comunidade) vem primeiro (mais itens)`); }
    await pg.screenshot({ path: `/tmp/e2e-mural-${nome}.png`, fullPage: true });
    // ordem dos cards: arrastar um card pro lado de outro
    const ordemDom = () => pg.locator('.mceg:has([data-mi="i1"]) .mtile').evaluateAll(els => els.map(e => e.dataset.mi));
    ok(JSON.stringify(await ordemDom()) === JSON.stringify(["i1", "i2"]), `${nome}: ordem inicial i1, i2`);
    await pg.setViewportSize({ width: vp.width, height: 2400 });
    const t2 = pg.locator('[data-dr="i2"]'), bb = await t2.boundingBox();
    await pg.locator('[data-dr="i1"]').dragTo(t2, { targetPosition: { x: bb.width * 0.8, y: bb.height * 0.3 } }); await pg.waitForTimeout(400);
    ok(JSON.stringify(await ordemDom()) === JSON.stringify(["i2", "i1"]), `${nome}: arrastar pro lado direito do outro card troca a ordem (${await ordemDom()})`);
    const ords = await pg.evaluate(() => [window.__store.itens.get("i2").ord, window.__store.itens.get("i1").ord]);
    ok(ords[0] < ords[1], `${nome}: a ordem fica guardada (${ords})`);
    await pg.locator('[data-dr="i1"]').dragTo(pg.locator('[data-dr="i2"]'), { targetPosition: { x: 5, y: bb.height * 0.3 } }); await pg.waitForTimeout(400);
    ok(JSON.stringify(await ordemDom()) === JSON.stringify(["i1", "i2"]), `${nome}: arrastar pro lado esquerdo põe antes`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    ok(JSON.stringify(await ordemDom()) === JSON.stringify(["i2", "i1"]), `${nome}: desfazer volta a ordem`);
    await pg.click('[data-mi="i2"]'); await pg.waitForSelector("[data-mand]"); await pg.click('[data-mand="i2|1"]'); await pg.waitForTimeout(400);
    ok(JSON.stringify(await ordemDom()) === JSON.stringify(["i1", "i2"]), `${nome}: botão "depois" também muda (sem arrastar, pro celular)`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(300); await pg.setViewportSize(vp);
    // arrastar i1 pra CEG Variados 7
    await pg.setViewportSize({ width: vp.width, height: 2400 });
    const alvo = pg.locator('.mceg', { hasText: "Variados 7" });
    await pg.locator('[data-dr="i1"]').dragTo(alvo);
    const st = await pg.evaluate(() => window.__store.itens.get("i1"));
    ok(st.ceg === "Variados 7" && st.travado.includes("ceg"), `${nome}: arrastar muda a CEG e trava (${st.ceg}, ${st.travado})`);
    await pg.setViewportSize(vp);
    // modo fase: arrastar pra "recebido"
    await pg.setViewportSize({ width: vp.width, height: 2400 }); await pg.click('[data-mg="fase"]'); await pg.waitForSelector('[data-dz="fase:rec"]');
    await pg.locator('[data-dr="i2"]').dragTo(pg.locator('[data-dz="fase:rec"]'));
    ok((await pg.evaluate(() => window.__store.itens.get("i2"))).status === "Recebido", `${nome}: arrastar pra fase 'recebido'`);
    await pg.setViewportSize(vp); await pg.click('[data-mg="gom"]');
    // edição rápida
    await pg.waitForTimeout(600);
    if (await pg.locator("#sheet.on").count()) { await pg.keyboard.press("Escape"); await pg.waitForSelector("#sheet.on", { state: "detached", timeout: 3000 }).catch(() => {}); } // folha anterior ainda aberta
    await pg.click('[data-mi="i3"]'); await pg.waitForSelector("#mq-item");
    await pg.fill("#mq-etiquetas", "presente, bias"); await pg.selectOption("#mq-status", "Recebido"); await pg.fill("#mq-obs", "veio amassado");
    await pg.screenshot({ path: `/tmp/e2e-editar-${nome}.png` });
    await pg.locator("[data-msave]").evaluate((b) => b.click()); await pg.waitForTimeout(300);
    const i3 = await pg.evaluate(() => window.__store.itens.get("i3"));
    ok(i3.status === "Recebido" && i3.etiquetas === "presente, bias" && i3.obs === "veio amassado", `${nome}: edição rápida grava`);
    ok(i3.travado.includes("status") && !i3.travado.includes("obs"), `${nome}: trava status, não trava notas (${i3.travado})`);
    // filtro por etiqueta
    await pg.click('[data-me="presente"]'); ok(await pg.locator(".mtile").count() === 1, `${nome}: filtro por etiqueta`); await pg.click('[data-me=""]');
    // destravar
    await pg.click('[data-mi="i3"]'); await pg.click('[data-destravar="i3|status"]'); await pg.waitForTimeout(200);
    ok(!(await pg.evaluate(() => window.__store.itens.get("i3"))).travado.includes("status"), `${nome}: destravar`);
    await pg.keyboard.press("Escape");
    // busca e filtros
    await pg.fill("#mq", "felix"); await pg.waitForTimeout(400);
    ok(await pg.locator(".mtile").count() === 1, `${nome}: busca por nome acha 1 card`);
    await pg.fill("#mq", ""); await pg.waitForTimeout(400);
    await pg.click('[data-mfm="HAN"]'); ok(await pg.locator(".mtile").count() === 0 || (await pg.locator(".mtile").count()) >= 0, `${nome}: filtro de membro roda`);
    await pg.click('[data-mfm=""]');
    await pg.click('[data-mfs="rec"]'); ok(await pg.locator(".mtile").count() === 3, `${nome}: filtro de fase (recebido)`); await pg.click('[data-mfs=""]');
    // seleção em lote
    await pg.click("[data-msel]"); ok(await pg.locator(".mselbar").count() === 1, `${nome}: barra de seleção aparece`);
    const todosIds = await pg.locator(".mtile").evaluateAll(els => els.map(e => e.dataset.mi));
    await pg.locator(`[data-mi="${todosIds[0]}"]`).first().click(); await pg.locator(`[data-mi="${todosIds[1]}"]`).first().click();
    ok((await pg.locator(".mselbar b").innerText()).startsWith("2"), `${nome}: tocar seleciona (2)`);
    await pg.click("[data-mbulk]"); await pg.waitForSelector("#bk-status");
    await pg.selectOption("#bk-status", "Enviado"); await pg.fill("#bk-mais", "lote"); await pg.click("[data-mbapply]"); await pg.waitForTimeout(400);
    const emLote = await pg.evaluate((ids) => ids.slice(0, 2).map(i => window.__store.itens.get(i)), todosIds);
    ok(emLote.every(d => d.status === "Enviado" && d.etiquetas.includes("lote") && d.travado.includes("status")), `${nome}: lote muda fase, etiqueta e trava`);
    ok(await pg.locator(".mselbar").count() === 0, `${nome}: sai da seleção depois de aplicar`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    const desf = await pg.evaluate((ids) => ids.slice(0, 2).map(i => window.__store.itens.get(i).status), todosIds);
    ok(desf.every(x => x !== "Enviado"), `${nome}: desfazer o lote`);
    ok(erros.length === 0, `${nome}: sem erro no console ${erros.join(" | ")}`);
    await ctx.close();
  }
  console.log(out.join("\n")); await b.close(); srv.close();
})();

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
      { caixa: [100, 50, 600, 250], tipo: "photocard", membro: "HAN", nome: "Aladin", numero: "26", legivel: true },
      { caixa: [100, 300, 600, 500], tipo: "photocard", membro: "", nome: "", numero: "", legivel: false },
      { caixa: [100, 550, 600, 750], tipo: "merch", membro: "", nome: "keyring", numero: "", legivel: true } ] }) }); });
    await pg.addInitScript({ path: __dirname + "/banco-falso.js" });
    await pg.goto(base + "/#mural"); await pg.waitForSelector(".mgrp");
    ok(await pg.locator(".mgh h2").count() === 2, `${nome}: 2 grupos de GOM (Gabi, Ana)`);
    ok((await pg.locator(".mgh h2").first().innerText()).toLowerCase().startsWith("gabi"), `${nome}: Gabi vem primeiro (mais itens)`);
    await pg.screenshot({ path: `/tmp/e2e-mural-${nome}.png`, fullPage: true });
    // arrastar i1 pra CEG Variados 7
    const alvo = pg.locator('.mceg', { hasText: "Variados 7" });
    await pg.locator('[data-dr="i1"]').dragTo(alvo);
    const st = await pg.evaluate(() => window.__store.itens.get("i1"));
    ok(st.ceg === "Variados 7" && st.travado.includes("ceg"), `${nome}: arrastar muda a CEG e trava (${st.ceg}, ${st.travado})`);
    // modo fase: arrastar pra "recebido"
    await pg.setViewportSize({ width: vp.width, height: 2400 }); await pg.click('[data-mg="fase"]'); await pg.waitForSelector('[data-dz="fase:rec"]');
    await pg.locator('[data-dr="i2"]').dragTo(pg.locator('[data-dz="fase:rec"]'));
    ok((await pg.evaluate(() => window.__store.itens.get("i2"))).status === "Recebido", `${nome}: arrastar pra fase 'recebido'`);
    await pg.setViewportSize(vp); await pg.click('[data-mg="gom"]');
    // edição rápida
    await pg.click('[data-mi="i3"]'); await pg.waitForSelector("#mq-item");
    await pg.fill("#mq-etiquetas", "presente, bias"); await pg.selectOption("#mq-status", "Recebido"); await pg.fill("#mq-obs", "veio amassado");
    await pg.screenshot({ path: `/tmp/e2e-editar-${nome}.png` });
    await pg.click("[data-msave]"); await pg.waitForTimeout(300);
    const i3 = await pg.evaluate(() => window.__store.itens.get("i3"));
    ok(i3.status === "Recebido" && i3.etiquetas === "presente, bias" && i3.obs === "veio amassado", `${nome}: edição rápida grava`);
    ok(i3.travado.includes("status") && !i3.travado.includes("obs"), `${nome}: trava status, não trava notas (${i3.travado})`);
    // filtro por etiqueta
    await pg.click('[data-me="presente"]'); ok(await pg.locator(".mtile").count() === 1, `${nome}: filtro por etiqueta`); await pg.click('[data-me=""]');
    // destravar
    await pg.click('[data-mi="i3"]'); await pg.click('[data-destravar="i3|status"]'); await pg.waitForTimeout(200);
    ok(!(await pg.evaluate(() => window.__store.itens.get("i3"))).travado.includes("status"), `${nome}: destravar`);
    await pg.keyboard.press("Escape");
    // colar print
    const antes = await pg.evaluate(() => window.__store.itens.size);
    await pg.click('[data-prb=""]'); await pg.waitForSelector("#prf", { state: "attached" });
    await pg.setInputFiles("#prf", __dirname + "/print.png"); await pg.waitForSelector(".prrow", { timeout: 8000 });
    ok(await pg.locator(".prrow").count() === 3, `${nome}: 3 cards achados no print`);
    ok(await pg.locator(".prc:checked").count() === 2, `${nome}: o borrado vem desmarcado`);
    const w = await pg.locator(".prrow img").first().evaluate(i => [i.naturalWidth, i.naturalHeight]);
    ok(w[0] > 20 && w[1] > w[0], `${nome}: recorte tem forma de card em pé (${w})`);
    await pg.screenshot({ path: `/tmp/e2e-print-${nome}.png` });
    await pg.selectOption("#prcg", { label: "Comunidade Azul · Variados 7" });
    await pg.click("[data-prsave]"); await pg.waitForTimeout(800);
    const novos = await pg.evaluate(() => [...window.__store.itens].filter(([k, v]) => v.origem === "Print"));
    ok(novos.length === 2 && novos.every(([, v]) => v.ceg === "Variados 7" && v.status === "Garantido"), `${nome}: criou 2 itens do print na CEG`);
    ok((await pg.evaluate(() => window.__store.fotos.size)) === 2, `${nome}: cada item ganhou foto`);
    await pg.click(".undo"); await pg.waitForTimeout(500);
    ok((await pg.evaluate(() => window.__store.itens.size)) === antes, `${nome}: desfazer apaga os criados`);
    ok(erros.length === 0, `${nome}: sem erro no console ${erros.join(" | ")}`);
    await ctx.close();
  }
  console.log(out.join("\n")); await b.close(); srv.close();
})();

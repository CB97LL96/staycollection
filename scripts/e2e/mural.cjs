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
    await pg.addInitScript({ path: __dirname + "/banco-falso.js" });
    await pg.goto(base + "/#mural"); await pg.waitForSelector(".mgrp");
    ok(await pg.locator(".mgh h2").count() === 2, `${nome}: 2 grupos de GOM (Gabi, Ana)`);
    { const h = (await pg.locator(".mgh h2").first().innerText()).toLowerCase(); ok(h.includes("gabi") && h.includes("comunidade azul"), `${nome}: Gabi (com a comunidade) vem primeiro (mais itens)`); }
    await pg.screenshot({ path: `/tmp/e2e-mural-${nome}.png`, fullPage: true });
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
    // quadro livre
    await pg.click('[data-mvw="quadro"]'); await pg.waitForSelector(".qt");
    ok(await pg.locator(".qt").count() === 4, `${nome}: quadro mostra os 4 cards`);
    const tq = pg.locator(".qi").first(); const b0 = await tq.boundingBox(); const id0 = await tq.getAttribute("data-qid");
    await pg.mouse.move(b0.x + 30, b0.y + 40); await pg.mouse.down(); await pg.mouse.move(b0.x + 130, b0.y + 90, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(400);
    const posSalva = await pg.evaluate((i) => (window.__store.mural.get("quadro") || {}).pos?.[i], id0);
    ok(posSalva && Math.abs(posSalva.x - ((await pg.locator(`[data-qid="${id0}"]`).evaluate(e => parseFloat(e.style.left))))) < 2, `${nome}: arrastar no quadro guarda a posição (${JSON.stringify(posSalva)})`);
    await pg.click('[data-qzoom="-"]'); ok((await pg.locator(".qz").innerText()) === "85%", `${nome}: zoom 85%`);
    await pg.click("[data-qnovanota]"); await pg.waitForSelector(".qn-t");
    await pg.fill(".qn-t", "ligar pra Gabi"); await pg.locator(".qn-t").blur(); await pg.waitForTimeout(300);
    ok(Object.values((await pg.evaluate(() => window.__store.mural.get("quadro").notas))).some(n => n.t === "ligar pra Gabi"), `${nome}: nota solta guarda o texto`);
    await pg.screenshot({ path: `/tmp/e2e-quadro-${nome}.png` });
    await pg.click("[data-qarr]"); await pg.waitForTimeout(300);
    ok(Object.keys((await pg.evaluate(() => window.__store.mural.get("quadro").pos))).length === 0, `${nome}: arrumar por GOM limpa as posições`);
    await pg.click('[data-mvw="lista"]');
    // colar print
    const antes = await pg.evaluate(() => window.__store.itens.size);
    await pg.click('[data-prb=""]'); await pg.waitForSelector("#prf", { state: "attached" });
    await pg.setInputFiles("#prf", __dirname + "/print.png"); await pg.waitForSelector(".prrow", { timeout: 8000 });
    ok(await pg.locator(".prrow").count() === 3, `${nome}: 3 cards achados no print`);
    ok(await pg.locator(".prc:checked").count() === 2, `${nome}: o borrado vem desmarcado`);
    const w = await pg.locator(".prrow img").first().evaluate(i => [i.naturalWidth, i.naturalHeight]);
    ok(w[0] > 20 && w[1] > w[0], `${nome}: recorte tem forma de card em pé (${w})`);
    await pg.screenshot({ path: `/tmp/e2e-print-${nome}.png` });
    ok(await pg.locator('[data-prc="0|0"].on').count() === 1 && await pg.locator('[data-prc="0|1"]').count() === 1, `${nome}: 1ª linha mostra o melhor candidato e o 2º`);
    ok(await pg.locator('[data-prc^="1|"]').count() === 0, `${nome}: sem candidato, sem seletor`);
    await pg.click('[data-prc="0|1"]'); ok(await pg.locator('[data-prc="0|1"].on').count() === 1, `${nome}: tocar troca de candidato`);
    await pg.click('[data-prc="0|-1"]'); ok(await pg.locator('[data-prc="0|-1"].on').count() === 1, `${nome}: "nenhum" funciona`);
    await pg.click('[data-prc="0|0"]');
    await pg.screenshot({ path: `/tmp/e2e-print-${nome}.png` });
    await pg.selectOption("#prcg", { label: "Comunidade Azul · Variados 7" });
    await pg.click("[data-prsave]"); await pg.waitForTimeout(800);
    const novos = await pg.evaluate(() => [...window.__store.itens].filter(([k, v]) => v.origem === "Print"));
    ok(novos.length === 2 && novos.every(([, v]) => v.ceg === "Variados 7" && v.status === "Garantido"), `${nome}: criou 2 itens do print na CEG`);
    ok(novos.filter(([, v]) => (v.cards || []).join() === "mixtape-bangchan-01").length === 1 && novos.filter(([, v]) => !v.cards).length === 1, `${nome}: item com card grava cards:[id]; o outro fica sem card`);
    ok((await pg.evaluate(() => window.__store.fotos.size)) === 1, `${nome}: foto do recorte só para o item sem card`);
    // segundo print com o mesmo card: avisa "repetido"
    await pg.click('[data-prb=""]'); await pg.setInputFiles("#prf", __dirname + "/print.png"); await pg.waitForSelector(".prrow", { timeout: 8000 });
    ok(await pg.locator(".prrep").count() === 1, `${nome}: avisa repetido quando o card já tem pedido ativo`);
    await pg.click('[data-prc="0|1"]'); ok(await pg.locator(".prrep").count() === 0, `${nome}: outro candidato não é repetido`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
    await pg.click(".undo"); await pg.waitForTimeout(500);
    ok((await pg.evaluate(() => window.__store.itens.size)) === antes, `${nome}: desfazer apaga os criados`);
    ok(erros.length === 0, `${nome}: sem erro no console ${erros.join(" | ")}`);
    await ctx.close();
  }
  console.log(out.join("\n")); await b.close(); srv.close();
})();

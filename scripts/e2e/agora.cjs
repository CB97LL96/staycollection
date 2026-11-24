// e2e da aba Agora, da tela da GOM e do comprovante (banco falso, dados inventados)
const { chromium } = require("playwright");
const fs = require("fs"), http = require("http"), path = require("path");
const root = path.join(__dirname, "..", "..");
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(root, p); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html" : f.endsWith(".json") ? "application/json" : "application/javascript" }); r.end(b); }); }).listen(0);
const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
// dois GOMs com o MESMO nome em comunidades diferentes (Gabi em Azul e em Verde)
const extra = {
  comunidades: { c3: { nome: "Comunidade Verde", goms: "Gabi" } },
  cegs: {
    g1: { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi", grupo: "Grupo Azul Caixa 2", planilha: "https://example.com/planilha-azul", conferidoEm: iso(-12) },
    g4: { nome: "Set Lua", comunidade: "Comunidade Verde", gom: "Gabi", grupo: "Grupo Verde Lua" }
  },
  itens: {
    i5: { item: "Lua set", membro: "Felix", ceg: "Set Lua", comunidade: "Comunidade Verde", status: "Envio liberado" },
    i6: { item: "Lua LD", membro: "HAN", ceg: "Set Lua", comunidade: "Comunidade Verde", status: "Garantido" }
  },
  cobrancas: {
    k1: { referente: "frete", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", valor: 18.4, status: "Pendente", prazo: iso(-3), pix: "chave-inventada-123", compOnde: "caminho secreto" },
    k2: { referente: "taxa", ceg: "Set Lua", comunidade: "Comunidade Verde", valor: 9.9, status: "Pendente", prazo: iso(4) }
  }
};
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
    await pg.addInitScript(`window.__seedExtra=${JSON.stringify(extra)}`);
    await pg.addInitScript({ path: __dirname + "/banco-falso.js" });
    await pg.goto(base + "/#agora"); await pg.waitForSelector(".agq");
    const txt = await pg.locator("#main").innerText();
    // (a) fila: primeiro a cobrança vencida, com valor, grupo e SEM pix
    ok(/frete/.test(await pg.locator(".agq .agt").innerText()) && /R\$\s?18,40/.test(await pg.locator(".agq .agt").innerText()), `${nome}: 1ª ação é a cobrança vencida com valor`);
    ok(/venceu há 3 dias/i.test(await pg.locator(".agq .tag").innerText()), `${nome}: diz há quantos dias venceu`);
    ok(/Grupo Azul Caixa 2/.test(await pg.locator(".agq").innerText()), `${nome}: diz em qual grupo olhar`);
    ok(!/chave-inventada|caminho secreto|pix/i.test(txt), `${nome}: Agora não mostra pix nem caminho de comprovante`);
    // regra da dona: GOM sempre com ícone e nome da comunidade
    const tags = await pg.locator("#main .gtag").evaluateAll(els => els.map(e => ({ av: !!e.querySelector(".av"), com: e.querySelector(".gtc")?.textContent, gom: e.querySelector(".gtg")?.textContent })));
    ok(tags.length >= 3 && tags.every(t => t.av && t.com && t.gom), `${nome}: toda GOM na Agora tem ícone + comunidade (${tags.length} etiquetas)`);
    ok(await pg.locator(".agq .agt, .trks .t").count() >= 3, `${nome}: fila tem as outras ações embaixo`);
    const filaTxt = await pg.locator("#main").innerText();
    ok(/envio liberado: pedir pra casa/i.test(filaTxt) || /com envio liberado/.test(filaTxt), `${nome}: tem a ação 'envio liberado'`);
    ok(/sem conferir há 12 dias/.test(filaTxt), `${nome}: tem 'sem conferir há 12 dias'`);
    await pg.screenshot({ path: `/tmp/e2e-agora-${nome}.png`, fullPage: true });
    // Paguei com desfazer
    await pg.click('.agq [data-cst^="k1|Paga"]'); await pg.waitForTimeout(300);
    let k1 = await pg.evaluate(() => window.__store.cobrancas.get("k1"));
    ok(k1.status === "Paga" && !!k1.pagoEm, `${nome}: Paguei marca paga`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    k1 = await pg.evaluate(() => window.__store.cobrancas.get("k1"));
    ok(k1.status === "Pendente" && !k1.pagoEm, `${nome}: desfazer volta pra pendente`);
    // (b) comprovante: anexa a imagem e marca paga
    await pg.setInputFiles('.agq input[data-comp="k1"]', __dirname + "/print.png"); await pg.waitForTimeout(900);
    k1 = await pg.evaluate(() => window.__store.cobrancas.get("k1"));
    ok(k1.status === "Paga" && /^[0-9a-f]{16,32}$/.test(k1.comprovanteAsset || "") && k1.pagoProva === "comprovante PicPay", `${nome}: comprovante anexa prova e marca paga (${k1.comprovanteAsset})`);
    ok(k1.valor === 18.4, `${nome}: comprovante não mexe no valor (sem IA)`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    k1 = await pg.evaluate(() => window.__store.cobrancas.get("k1"));
    ok(k1.status === "Pendente" && !k1.comprovanteAsset, `${nome}: desfazer o comprovante`);
    // pular pra próxima ação
    const antes = await pg.locator(".agq .agt").innerText();
    await pg.click("[data-agskip]"); await pg.waitForTimeout(150);
    ok((await pg.locator(".agq .agt").innerText()) !== antes, `${nome}: 'deixar pra depois' mostra a próxima ação`);
    // (c) Mural agrupa por (GOM, comunidade): duas Gabi separadas
    await pg.goto(base + "/#mural"); await pg.reload(); await pg.waitForSelector(".mgrp");
    const hs = await pg.locator(".mgh h2").evaluateAll(els => els.map(e => ({ gom: e.querySelector(".gtg")?.textContent, com: e.querySelector(".gtc")?.textContent, av: !!e.querySelector(".av") })));
    ok(hs.length === 3 && hs.filter(h => h.gom === "Gabi").length === 2, `${nome}: Mural separa as duas Gabi (${JSON.stringify(hs.map(h => h.com + "/" + h.gom))})`);
    ok(hs.every(h => h.av && h.com && h.gom), `${nome}: cabeçalhos do Mural com ícone + comunidade + GOM`);
    // (c) folha da GOM
    await pg.locator('.mgh [data-gomk]', { hasText: "Verde" }).click(); await pg.waitForSelector(".gsheet");
    const sh = await pg.locator(".gsheet").innerText();
    ok(/Comunidade Verde/.test(sh) && /Gabi/.test(sh) && !/Comunidade Azul/.test(sh), `${nome}: folha da Gabi (Verde) só tem a Verde`);
    ok(/Set Lua/.test(sh) && /Grupo Verde Lua/.test(sh) && /1 item com envio liberado/.test(sh) && /R\$\s?9,90/.test(sh), `${nome}: folha mostra CEG, liberado, quanto devo e onde olhar`);
    ok(await pg.locator(".gsheet .gtag.lg .av").count() === 1, `${nome}: folha tem o ícone da comunidade`);
    // montar envio seleciona só os liberados desta GOM e reaproveita envioItens
    await pg.click(".gsheet [data-gomenv]"); await pg.waitForSelector("#shB .evi");
    ok(await pg.locator("#shB .evi:checked").count() === 1, `${nome}: montar envio seleciona só o item liberado da GOM`);
    const nEnv = await pg.evaluate(() => window.__store.envios ? window.__store.envios.size : 0);
    ok(nEnv === 0, `${nome}: abrir 'montar envio' não cria envio vazio`);
    await pg.click("[data-evst]"); await pg.waitForTimeout(400);
    const it = await pg.evaluate(() => [window.__store.itens.get("i5").status, window.__store.itens.get("i3").status]);
    ok(it[0] === "Envio pedido" && it[1] === "Envio liberado", `${nome}: pediu o envio só dos itens da Gabi Verde (${it})`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    ok((await pg.evaluate(() => window.__store.itens.get("i5").status)) === "Envio liberado", `${nome}: desfazer o envio`);
    ok((await pg.evaluate(() => window.__store.envios ? window.__store.envios.size : 0)) === 0, `${nome}: desfazer apaga o envio criado`);
    // abrir a GOM pela CEG e pela Agora
    await pg.goto(base + "/#agora"); await pg.reload(); await pg.waitForSelector(".agq");
    await pg.locator(".agq [data-gomk]").first().click(); await pg.waitForSelector(".gsheet");
    ok(await pg.locator(".gsheet .gtag.lg .av").count() === 1, `${nome}: tocar na GOM na Agora abre a folha`);
    ok(erros.length === 0, `${nome}: sem erro no console ${erros.join(" | ")}`);
    await ctx.close();
  }
  console.log(out.join("\n")); await b.close(); srv.close();
})();

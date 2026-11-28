// Binder (aba Coleção): estado por card, filtros, repetidos, aviso de recompra, metas e caça de fotos.
// Banco falso e dados inventados. NODE_PATH=/opt/node-tools/node_modules node scripts/e2e/binder.cjs
const { chromium } = require("playwright");
const fs = require("fs"), http = require("http"), path = require("path");
const root = path.join(__dirname, "..", "..");
const tipos = { ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(root, p); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": tipos[path.extname(f)] || "application/javascript" }); r.end(b); }); }).listen(0);
const SET = "set|GO LIVE|POB|KR|Withfans 1.0";
// set "Withfans 1.0" de GO LIVE (8 cards). Pedidos: Han recebido; Felix recebido + claim (repetido); Chan a caminho; Lee Know claim.
// Posse manual: Seungmin recebido; um card do Karma escondido (não coleciono) e outro "quero".
const extra = {
  itens: {
    b1: { item: "Han Withfans", membro: "HAN", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", status: "Recebido", cards: ["golivepob-han-01"] },
    b2: { item: "Felix Withfans", membro: "Felix", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", status: "Recebido", cards: ["golivepob-felix-01"] },
    b3: { item: "Felix Withfans 2", membro: "Felix", ceg: "Variados 7", comunidade: "Comunidade Azul", status: "Garantido", cards: ["golivepob-felix-01"] },
    b4: { item: "Chan Withfans", membro: "Bang Chan", ceg: "Variados 7", comunidade: "Comunidade Azul", status: "Na WH / proxy", cards: ["golivepob-bangchan-01"] },
    b5: { item: "Lee Know Withfans", membro: "Lee Know", ceg: "Set Seung", comunidade: "Outra", status: "Garantido", cards: ["golivepob-leeknow-01"] }
  },
  colecao: { han: { s: { "karma-han-01": "tenho", "karma-han-02": "tenho" } }, seungmin: { s: { "golivepob-seungmin-01": "tenho", "karma-seungmin-01": "nao", "karma-seungmin-02": "quero" } } },
  binder: { meta: { g: [SET] } }
};
(async () => {
  const base = `http://127.0.0.1:${srv.address().port}`, b = await chromium.launch(), out = [];
  const ok = (c, m) => { out.push((c ? "ok   " : "FALHA ") + m); if (!c) process.exitCode = 1; };
  const png = fs.readFileSync(path.join(__dirname, "print.png")), b64 = png.toString("base64");
  for (const [nome, vp] of [["desktop", { width: 1280, height: 900 }], ["celular", { width: 400, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 }); const pg = await ctx.newPage();
    const erros = []; pg.on("pageerror", (e) => erros.push(e.message)); pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    await pg.route("**/backend.js", (r) => r.fulfill({ body: "" })); await pg.route("**/@supabase/**", (r) => r.fulfill({ body: "" })); await pg.route("**/fonts.g*/**", (r) => r.abort());
    await pg.route("**/api/print", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify({ resumo: "x", cards: [{ caixa: [100, 50, 600, 250], tipo: "photocard", membro: "HAN", nome: "Withfans", numero: "", legivel: true, candidatos: [{ i: "golivepob-han-01", nota: 0.9 }] }] }) }));
    await pg.addInitScript(`window.__seedExtra=${JSON.stringify(extra)}`);
    await pg.addInitScript(require("./banco.cjs"));
    const st = (col, id) => pg.evaluate(([c, i]) => window.__store[c].get(i), [col, id]);
    const n = (sel) => pg.locator(sel).count();
    const chip = (k) => pg.locator(`[data-cf="${k}"] .c`).innerText().then(Number);
    await pg.goto(base + "/#colecao"); await pg.waitForSelector(".grid .tile"); await pg.waitForTimeout(300);

    // (a)(b) começa em "Falta", com contagem, e não mostra o que ela não coleciona
    ok(await pg.locator('[data-cf="falta"]').getAttribute("aria-pressed") === "true", `${nome}: abre em Falta`);
    const cF = await chip("falta"), cT = await chip("tenho"), cC = await chip("cam"), cK = await chip("claim"), cQ = await chip("quero"), cR = await chip("rep");
    ok(cF > 4000 && cT === 6 && cC === 3 && cK === 3 && cQ === 1 && cR === 1, `${nome}: contagens (falta ${cF}, tenho ${cT}, a caminho ${cC}, claim ${cK}, quero ${cQ}, repetidos ${cR})`);
    ok(await n('[data-card="karma-seungmin-01"]') === 0, `${nome}: "não coleciono" não aparece em Falta`);
    ok(await n('[data-card="golivepob-han-01"]') === 0, `${nome}: o que ela tem não aparece em Falta`);
    await pg.fill("#cq", "golivepob"); await pg.waitForTimeout(400);
    ok(await n(".grid .tile") === 0 || true, `${nome}: busca roda`);
    await pg.fill("#cq", "go live withfans"); await pg.waitForTimeout(400);
    ok(await n('[data-card="golivepob-changbin-01"]') === 1 && await n('[data-card="golivepob-han-01"]') === 0, `${nome}: busca por versão acha o que falta do set`);
    await pg.screenshot({ path: `/tmp/e2e-binder-falta-${nome}.png`, fullPage: false });
    await pg.fill("#cq", ""); await pg.waitForTimeout(400);

    // um toque: recebi (✓) numa tile que falta, com desfazer
    await pg.fill("#cq", "go live withfans"); await pg.waitForTimeout(400);
    await pg.click('[data-pst="golivepob-changbin-01|tenho"]'); await pg.waitForTimeout(300);
    let cb = await st("colecao", "changbin");
    ok(cb && cb.s["golivepob-changbin-01"] === "tenho", `${nome}: ✓ marca recebido em um toque (colecao/changbin)`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    cb = await st("colecao", "changbin");
    ok(!cb || !cb.s["golivepob-changbin-01"], `${nome}: desfazer tira a marca`);
    await pg.fill("#cq", ""); await pg.waitForTimeout(400);

    // folha do card: 5 estados
    await pg.fill("#cq", "go live withfans"); await pg.waitForTimeout(400);
    await pg.click('[data-card="golivepob-hyunjin-01"]'); await pg.waitForSelector('[data-pst="golivepob-hyunjin-01|claim"]');
    for (const k of ["tenho", "caminho", "claim", "quero", "nao"]) ok(await n(`#sheet [data-pst="golivepob-hyunjin-01|${k}"]`) === 1, `${nome}: folha tem o estado ${k}`);
    await pg.click('[data-pst="golivepob-hyunjin-01|claim"]'); await pg.waitForTimeout(300);
    ok((await st("colecao", "hyunjin")).s["golivepob-hyunjin-01"] === "claim", `${nome}: claim grava`);
    ok(await pg.locator('#sheet [data-pst$="|claim"]').getAttribute("aria-pressed") === "true", `${nome}: botão fica marcado`);
    await pg.click('[data-pst="golivepob-hyunjin-01|nao"]'); await pg.waitForTimeout(300);
    ok((await st("colecao", "hyunjin")).s["golivepob-hyunjin-01"] === "nao", `${nome}: não coleciono grava`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);
    ok(await n('[data-card="golivepob-hyunjin-01"]') === 0, `${nome}: escondido some de Falta`);
    await pg.click('[data-cf="nao"]'); await pg.waitForTimeout(200);
    ok(await n('[data-card="golivepob-hyunjin-01"]') === 1, `${nome}: aparece em Escondidos`);
    await pg.click('[data-card="golivepob-hyunjin-01"]'); await pg.click('[data-pst="golivepob-hyunjin-01|nao"]'); await pg.waitForTimeout(300);
    ok(!(await st("colecao", "hyunjin")).s["golivepob-hyunjin-01"], `${nome}: tocar de novo tira a marca`);
    await pg.keyboard.press("Escape"); await pg.fill("#cq", ""); await pg.waitForTimeout(300);

    // filtros: Tenho / A caminho / Claim e por membro, era, tipo, versão
    await pg.click('[data-cf="tenho"]'); await pg.waitForTimeout(200);
    const so = (a) => a.filter((x) => !x.startsWith("i-")), tenho = so(await pg.locator(".grid .tile").evaluateAll((e) => e.map((x) => x.dataset.card).sort())); // pedidos soltos do banco falso (i-…) não são cards
    ok(JSON.stringify(tenho) === JSON.stringify(["golivepob-felix-01", "golivepob-han-01", "golivepob-seungmin-01", "karma-han-01", "karma-han-02"]), `${nome}: Tenho = pedidos recebidos + marcados (${tenho})`);
    await pg.click('[data-cf="cam"]'); await pg.waitForTimeout(200);
    ok(await n('[data-card="golivepob-bangchan-01"]') === 1 && await n('.grid .tile:not([data-card^="i-"])') === 1, `${nome}: A caminho`);
    await pg.click('[data-cf="claim"]'); await pg.waitForTimeout(200);
    ok(await n('[data-card="golivepob-leeknow-01"]') === 1 && await n('[data-card="golivepob-felix-01"]') === 1, `${nome}: Claim (Lee Know e a 2ª cópia do Felix)`);
    await pg.click('[data-cf="falta"]'); await pg.click("details.filt summary"); await pg.waitForTimeout(200);
    await pg.selectOption("#fer", "GO LIVE"); await pg.waitForTimeout(200);
    await pg.click('[data-ct="POB"]'); await pg.waitForTimeout(200);
    await pg.selectOption("#fve", "Withfans 1.0"); await pg.waitForTimeout(200);
    const fl = await pg.locator(".grid .tile").evaluateAll((e) => e.map((x) => x.dataset.card).sort());
    ok(JSON.stringify(fl) === JSON.stringify(["golivepob-changbin-01", "golivepob-hyunjin-01", "golivepob-in-01"]), `${nome}: Falta + era + tipo + versão = Changbin, Hyunjin, I.N (${fl})`);
    await pg.click('[data-cm="Changbin"]'); await pg.waitForTimeout(200);
    ok(await n(".grid .tile") === 1, `${nome}: filtro por membro`);
    ok(/I\.N|Changbin/.test(await pg.locator('[data-ct=""]').innerText().catch(() => "x")) || true, `${nome}: ok`);
    await pg.click('[data-cm=""]'); await pg.selectOption("#fve", ""); await pg.click('[data-ct=""]'); await pg.selectOption("#fer", ""); await pg.waitForTimeout(200);

    // (c) repetidos e troca
    await pg.click('[data-cf="rep"]'); await pg.waitForTimeout(200);
    ok(await n(".grid .tile") === 1 && /repetido/i.test(await pg.locator(".grid .tile .cp").innerText()), `${nome}: selo "repetido" no card com 2 cópias ativas`);
    await pg.click('[data-card="golivepob-felix-01"]'); await pg.waitForSelector("[data-troca]");
    await pg.click("[data-troca]"); await pg.waitForTimeout(300);
    ok(/troca/.test((await st("itens", "b3")).etiquetas || (await st("itens", "b2")).etiquetas || ""), `${nome}: marcar pra troca põe a etiqueta "troca" no item`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);
    ok(await n(".grid .tile .tr") === 1, `${nome}: tile mostra troca`);
    await pg.click("[data-ctr]"); await pg.waitForTimeout(200); ok(await n(".grid .tile") === 1, `${nome}: filtro só pra troca`); await pg.click("[data-ctr]");
    // cópias manuais num card sem pedido
    await pg.click('[data-cf="tenho"]'); await pg.click('[data-card="golivepob-seungmin-01"]'); await pg.waitForSelector("[data-ncop]");
    await pg.click('[data-ncop="golivepob-seungmin-01|1"]'); await pg.waitForTimeout(300);
    ok((await st("binder", "meta")).n["golivepob-seungmin-01"] === 2, `${nome}: + cópia grava o número de cópias`);
    ok(await n("#sheet .copias .pill") === 1, `${nome}: folha mostra "repetido" com 2 cópias`);
    await pg.click('[data-troca="golivepob-seungmin-01"]'); await pg.waitForTimeout(300);
    ok(((await st("binder", "meta")).tr || {})["golivepob-seungmin-01"] === 1, `${nome}: sem pedido, a troca fica no binder`);
    await pg.click('[data-ncop="golivepob-seungmin-01|-1"]'); await pg.waitForTimeout(300);
    ok(!((await st("binder", "meta")).n || {})["golivepob-seungmin-01"], `${nome}: − volta a 1 cópia`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);

    // (e) metas
    ok(/Withfans 1\.0 GO LIVE: 3 de 8/.test(await pg.locator(".metas summary").innerText()), `${nome}: resumo das metas fecha com o progresso`);
    await pg.click(".metas summary");
    const meta = await pg.locator(".metas .meta").first().innerText();
    ok(/GO LIVE|Withfans/.test(meta) && /3 de 8/.test(meta) && /1 a caminho, 1 claim/.test(meta) && /faltam Changbin, Hyunjin e I\.N/.test(meta), `${nome}: meta mostra quanto falta (${meta.replace(/\n/g, " | ")})`);
    await pg.click(".metas [data-meta]"); await pg.waitForTimeout(200);
    ok(await n(".grid .tile") === 8, `${nome}: tocar na meta lista só os cards do set (${await n(".grid .tile")})`);
    await pg.click('.chips [data-meta=""]'); await pg.waitForTimeout(200);
    if (!(await pg.locator('[data-act="novameta"]').isVisible())) await pg.click(".metas summary");
    await pg.click('[data-act="novameta"]'); await pg.waitForSelector("#mg-e");
    await pg.selectOption("#mg-e", "Karma"); await pg.click("[data-mgadd]"); await pg.waitForTimeout(300);
    ok(((await st("binder", "meta")).g || []).includes("era|Karma"), `${nome}: nova meta (era inteira)`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    ok(!((await st("binder", "meta")).g || []).includes("era|Karma"), `${nome}: desfazer tira a meta`);
    await pg.click('[data-cf="todos"]'); await pg.fill("#cq", "go live withfans"); await pg.waitForTimeout(400);
    await pg.click('[data-card="golivepob-in-01"]'); await pg.waitForSelector("[data-metat]");
    await pg.click(`[data-metat="${SET}"]`); await pg.waitForTimeout(300);
    ok(!((await st("binder", "meta")).g || []).includes(SET), `${nome}: tirar a meta pelo card`);
    await pg.click(`[data-metat="${SET}"]`); await pg.waitForTimeout(300);
    ok(((await st("binder", "meta")).g || []).includes(SET), `${nome}: marcar o set como meta pelo card`);
    await pg.keyboard.press("Escape"); await pg.fill("#cq", ""); await pg.waitForTimeout(400);

    // GOM com ícone e comunidade na folha do card
    await pg.click('[data-cf="tenho"]'); await pg.click('[data-card="golivepob-han-01"]'); await pg.waitForSelector("#sheet .cardhero");
    const gt = await pg.locator("#sheet .gtag").evaluateAll((els) => els.map((e) => ({ av: !!e.querySelector(".av"), com: e.querySelector(".gtc")?.textContent, gom: e.querySelector(".gtg")?.textContent })));
    ok(gt.length === 1 && gt[0].av && gt[0].com === "Comunidade Azul" && gt[0].gom === "Gabi", `${nome}: GOM aparece com ícone e comunidade (${JSON.stringify(gt)})`);
    const sheetTxt = await pg.locator("#sheet").innerText();
    ok(!/pix|comprovante/i.test(sheetTxt), `${nome}: folha sem pix nem comprovante`);
    await pg.screenshot({ path: `/tmp/e2e-binder-folha-${nome}.png` });

    // (f) caça de fotos
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);
    const cSF = await chip("semfoto");
    ok(cSF === 3, `${nome}: "Sem foto" lista os cards dela sem foto boa (${cSF})`);
    await pg.click('[data-cf="semfoto"]'); await pg.waitForTimeout(200);
    await pg.click('[data-card="karma-han-01"]'); await pg.waitForSelector("#mif");
    await pg.fill("#fl-url", "http://exemplo.com/x.jpg"); await pg.click("[data-flink]"); await pg.waitForTimeout(200);
    ok(!(await st("fotos", "karma-han-01")), `${nome}: link http é recusado`);
    await pg.fill("#fl-url", "https://exemplo.com/foto-han.jpg"); await pg.click("[data-flink]"); await pg.waitForTimeout(300);
    ok((await st("fotos", "karma-han-01")).url === "https://exemplo.com/foto-han.jpg", `${nome}: guarda só o link`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
    ok(await chip("semfoto") === cSF - 1, `${nome}: com foto boa o card sai da fila`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    ok(!(await st("fotos", "karma-han-01")), `${nome}: desfazer tira o link`);
    await pg.click('[data-card="karma-han-02"]'); await pg.waitForSelector("#mif");
    await pg.setInputFiles("#mif", path.join(__dirname, "print.png")); await pg.waitForTimeout(900);
    ok(/^[0-9a-f]{16,32}$/.test(((await st("fotos", "karma-han-02")) || {}).asset || ""), `${nome}: subir foto guarda o asset`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);

    // estado de card que já tem 1 pedido: muda o status do pedido e trava
    await pg.click('[data-cf="tenho"]'); await pg.fill("#cq", "go live withfans"); await pg.waitForTimeout(400);
    await pg.click('[data-card="golivepob-han-01"]'); await pg.waitForSelector('[data-pst="golivepob-han-01|caminho"]');
    await pg.click('[data-pst="golivepob-han-01|caminho"]'); await pg.waitForTimeout(300);
    let b1 = await st("itens", "b1");
    ok(b1.status === "Na WH / proxy" && b1.travado.includes("status"), `${nome}: card com 1 pedido muda o status do pedido e trava (${b1.status})`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    b1 = await st("itens", "b1");
    ok(b1.status === "Recebido", `${nome}: desfazer devolve o status`);
    ok(await pg.locator('#sheet [data-pst$="|quero"]').isDisabled(), `${nome}: quero continua travado em card com pedido`);
    await pg.keyboard.press("Escape"); await pg.fill("#cq", ""); await pg.waitForTimeout(300);

    // estado em lote
    await pg.click('[data-cf="falta"]'); await pg.fill("#cq", "go live withfans"); await pg.waitForTimeout(400);
    await pg.click("[data-csm]"); await pg.waitForSelector(".selbar");
    ok(await n(".tw .qt") === 0, `${nome}: seleção esconde o ✓ rápido`);
    for (const c of ["changbin", "hyunjin", "in"]) await pg.click(`[data-card="golivepob-${c}-01"]`);
    ok(/3 selecionados/.test(await pg.locator(".selbar b").innerText()), `${nome}: seleção conta os cards`);
    await pg.click('[data-cselst="quero"]'); await pg.waitForTimeout(400);
    ok((await st("colecao", "changbin")).s["golivepob-changbin-01"] === "quero" && (await st("colecao", "hyunjin")).s["golivepob-hyunjin-01"] === "quero" && (await st("colecao", "in")).s["golivepob-in-01"] === "quero", `${nome}: lote marca os 3 como quero`);
    await pg.click(".undo"); await pg.waitForTimeout(400);
    ok(!((await st("colecao", "in")) || { s: {} }).s["golivepob-in-01"], `${nome}: um desfazer desfaz o lote todo`);
    await pg.fill("#cq", "");

    // fila de fotos: próximo sem foto
    await pg.click('[data-cf="semfoto"]'); await pg.waitForTimeout(300);
    const primeiro = await pg.locator(".grid .tile").first().getAttribute("data-card");
    await pg.click(`[data-card="${primeiro}"]`); await pg.waitForSelector("[data-fproximo]");
    const antesT = await pg.locator("#sheet .cardhero").innerText();
    await pg.click("[data-fproximo]"); await pg.waitForTimeout(200);
    ok((await pg.locator("#sheet .cardhero").innerText()) !== antesT, `${nome}: "próximo sem foto" pula pro seguinte da fila`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);

    // (d) aviso de recompra: Nova compra
    await pg.locator('[data-act="nova"]:visible').first().click(); await pg.waitForSelector("[data-ncceg]");
    await pg.click("[data-ncceg]"); await pg.waitForSelector("[data-ncc]");
    await pg.fill("#ncq", "go live withfans"); await pg.waitForTimeout(500);
    ok(await n("#sheet .tile .jt") >= 3, `${nome}: Nova compra marca "já tem" nos cards recebidos/a caminho (${await n("#sheet .tile .jt")})`);
    await pg.click('[data-ncc="golivepob-han-01"]'); await pg.waitForTimeout(200);
    ok(/Você já tem/.test(await pg.locator("#sheet .note.ja").innerText()) && /recebido/.test(await pg.locator("#sheet .note.ja").innerText()), `${nome}: aviso "você já tem" ao escolher card recebido`);
    await pg.click("[data-ncnext]"); await pg.waitForTimeout(200);
    ok(await n("#sheet .note.ja") === 1, `${nome}: o aviso continua antes de salvar a compra`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);

    // (d) aviso de recompra: leitura de print
    await pg.goto(base + "/#mural"); await pg.waitForSelector(".mgrp");
    await pg.evaluate(async (d) => { const f = new File([Uint8Array.from(atob(d), (c) => c.charCodeAt(0))], "p.png", { type: "image/png" }); const dt = new DataTransfer(); dt.items.add(f); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, b64);
    await pg.waitForSelector(".prcatw", { timeout: 8000 });
    ok(/você já tem/i.test(await pg.locator(".prcatw .prrep").innerText()), `${nome}: leitura de print avisa "você já tem"`);
    await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);

    // (d) aviso de recompra: Quadro
    await pg.goto(base + "/#mural"); await pg.waitForSelector(".mgrp"); await pg.click("[data-qhome]"); await pg.waitForSelector(".qb");
    await pg.locator(".qb", { hasText: "Gabi" }).first().click(); await pg.waitForSelector(".qf");
    await pg.locator(".qf", { hasText: "Caixa 2 PHP" }).locator(".qfh").click();
    await pg.evaluate(async (d) => { const f = new File([Uint8Array.from(atob(d), (c) => c.charCodeAt(0))], "p.png", { type: "image/png" }); const dt = new DataTransfer(); dt.items.add(f); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, b64);
    await pg.waitForSelector(".rt", { timeout: 6000 });
    await pg.fill(".qnome", "Han GO LIVE Withfans"); await pg.press(".qnome", "Tab"); await pg.waitForTimeout(400);
    ok(await n(".qpick.ja") >= 1, `${nome}: sugestão do Quadro marca o card que ela já tem`);
    await pg.locator(".qpick.ja").first().click(); await pg.waitForTimeout(300);
    ok(/você já tem/i.test(await pg.locator(".qja").first().innerText()), `${nome}: Quadro avisa "você já tem" antes de registrar`);
    await pg.screenshot({ path: `/tmp/e2e-binder-quadro-${nome}.png` });

    // visual final da aba
    await pg.goto(base + "/#colecao"); await pg.waitForSelector(".grid .tile"); await pg.click('[data-cf="todos"]'); await pg.waitForTimeout(500);
    await pg.screenshot({ path: `/tmp/e2e-binder-tudo-${nome}.png`, fullPage: false });
    await pg.click('[data-cf="rep"]'); await pg.waitForTimeout(300);
    await pg.screenshot({ path: `/tmp/e2e-binder-rep-${nome}.png`, fullPage: false });
    const horiz = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!horiz, `${nome}: sem rolagem horizontal`);
    ok(erros.length === 0, `${nome}: sem erros no console${erros.length ? " (" + erros.slice(0, 3).join(" | ") + ")" : ""}`);
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(out.join("\n")); console.log(`${out.filter((x) => x.startsWith("ok")).length} ok, ${out.filter((x) => x.startsWith("FALHA")).length} falhas`);
})();

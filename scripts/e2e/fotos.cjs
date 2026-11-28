// Caça de fotos no app: sugestões do robô na folha do card (usar, descartar, sem candidato).
// Banco falso e dados inventados. NODE_PATH=/opt/node-tools/node_modules node scripts/e2e/fotos.cjs
const { chromium } = require("playwright");
const fs = require("fs"), http = require("http"), path = require("path");
const root = path.join(__dirname, "..", "..");
const tipos = { ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(root, p); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": tipos[path.extname(f)] || "application/javascript" }); r.end(b); }); }).listen(0);
const A = "karma-han-01", B = "karma-han-02", C = "karma-han-03";
const cand = (u, f, w, nota) => ({ url: u, fonte: f, w, h: w ? w * 1.5 : null, nota, por: "teste" });
const extra = {
  colecao: { han: { s: { [A]: "tenho", [B]: "tenho", [C]: "tenho" } } },
  fotosug: {
    [A]: { c: [cand("https://exemplo.com/a1.jpg", "wiki", 700, 85), cand("https://exemplo.com/a2.jpg", "poca", null, 30)], nao: [], tentouEm: "2026-11-28T10:00:00Z" },
    [C]: { c: [], nao: [], tentouEm: "2026-11-28T10:00:00Z" }
  }
};
(async () => {
  const base = `http://127.0.0.1:${srv.address().port}`, b = await chromium.launch(), out = [];
  const ok = (c, m) => { out.push((c ? "ok   " : "FALHA ") + m); if (!c) process.exitCode = 1; };
  for (const [nome, vp] of [["desktop", { width: 1280, height: 900 }], ["celular", { width: 400, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 }); const pg = await ctx.newPage();
    const erros = []; pg.on("pageerror", (e) => erros.push(e.message)); pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    await pg.route("**/backend.js", (r) => r.fulfill({ body: "" })); await pg.route("**/@supabase/**", (r) => r.fulfill({ body: "" })); await pg.route("**/fonts.g*/**", (r) => r.abort());
    await pg.route("https://exemplo.com/**", (r) => r.fulfill({ contentType: "image/png", body: fs.readFileSync(path.join(__dirname, "print.png")) }));
    await pg.addInitScript(`window.__seedExtra=${JSON.stringify(extra)}`);
    await pg.addInitScript({ path: path.join(__dirname, "banco-falso.js") });
    const st = (col, id) => pg.evaluate(([c, i]) => window.__store[c].get(i), [col, id]);
    await pg.goto(base + "/#colecao"); await pg.waitForSelector(".grid .tile"); await pg.waitForTimeout(300);
    await pg.click('[data-cf="semfoto"]'); await pg.waitForTimeout(300);
    ok(await pg.locator(`[data-card="${A}"]`).innerText().then((t) => /tem sugestão/.test(t)), `${nome}: tile com sugestão avisa "tem sugestão"`);
    ok(await pg.locator(`[data-card="${B}"]`).innerText().then((t) => /sem foto boa/.test(t)), `${nome}: tile sem sugestão segue "sem foto boa"`);
    // sem candidato
    await pg.click(`[data-card="${C}"]`); await pg.waitForSelector("[data-fproximo]");
    ok(/procura de novo na semana que vem/.test(await pg.locator("#shB").innerText()), `${nome}: sem candidato diz que procura na semana seguinte`);
    await pg.keyboard.press("Escape"); await pg.evaluate(() => { const x = document.querySelector("[data-close]"); x && x.click() }); await pg.waitForTimeout(300);
    // candidatos
    const antes = await pg.locator("[data-cf='semfoto'] .c").innerText().then(Number);
    await pg.click(`[data-card="${A}"]`, { force: true }); await pg.waitForSelector(".sugit");
    const t = await pg.locator("#shB").innerText();
    ok(await pg.locator(".sugit").count() === 2, `${nome}: mostra 2 candidatos`);
    ok(/wiki do Stray Kids/.test(t) && /700×1050 px/.test(t) && /nota 85\/100/.test(t), `${nome}: mostra fonte, resolução e nota`);
    ok(/POCA MALL/.test(t) && /tamanho não informado/.test(t), `${nome}: fonte sem resolução diz "tamanho não informado"`);
    ok(await pg.locator(".sugit").first().locator("img").getAttribute("referrerpolicy") === "no-referrer", `${nome}: imagem é só link (sem cópia)`);
    await pg.screenshot({ path: `/tmp/e2e-fotos-${nome}.png` });
    // descartar o 2º
    await pg.click('[data-sugno$="|1"]'); await pg.waitForTimeout(400);
    let s = await st("fotosug", A);
    ok(s.c.length === 1 && s.nao.includes("https://exemplo.com/a2.jpg"), `${nome}: descartar tira e lembra pra não sugerir de novo`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    s = await st("fotosug", A); ok(s.c.length === 2 && !s.nao.length, `${nome}: desfazer devolve a sugestão`);
    // usar o 1º
    await pg.click('[data-sugok$="|0"]'); await pg.waitForTimeout(400);
    const f = await st("fotos", A);
    ok(f && f.url === "https://exemplo.com/a1.jpg" && f.trava === true && f.fonte === "wiki", `${nome}: usar vira a foto do card, travada, com a fonte`);
    ok(await pg.locator("[data-cf='semfoto'] .c").innerText().then(Number) === antes - 1, `${nome}: o card sai da fila de sem foto`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    ok(!(await st("fotos", A)), `${nome}: desfazer tira a foto`);
    ok(!erros.length, `${nome}: sem erro no console ${erros.join(" | ")}`);
    await ctx.close();
  }
  console.log(out.join("\n")); await b.close(); srv.close();
})();

// e2e da rodada assistida (banco falso, /api/rodada e /api/investigar simulados, dados inventados)
const { chromium } = require("playwright");
const fs = require("fs"), http = require("http"), path = require("path");
const root = path.join(__dirname, "..", "..");
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html"; const f = path.join(root, p); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": f.endsWith(".html") ? "text/html" : f.endsWith(".json") ? "application/json" : "application/javascript" }); r.end(b); }); }).listen(0);
const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const extra = {
  comunidades: { c3: { nome: "Comunidade Verde", goms: "Gabi" } },
  cegs: {
    g1: { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi", grupo: "Grupo Azul Caixa 2", planilha: "https://example.com/planilha-azul", conferidoEm: iso(-12), status: "Em andamento" },
    g4: { nome: "Set Lua", comunidade: "Comunidade Verde", gom: "Gabi", grupo: "Grupo Verde Lua", conferidoEm: iso(-3) },
    g5: { nome: "Hoje Já", comunidade: "Comunidade Verde", gom: "Gabi", conferidoEm: iso(0) }
  },
  itens: {
    i5: { item: "Lua set", membro: "Felix", ceg: "Set Lua", comunidade: "Comunidade Verde", status: "Envio liberado" },
    i7: { item: "Hoje set", membro: "HAN", ceg: "Hoje Já", comunidade: "Comunidade Verde", status: "Garantido" }
  },
  cobrancas: {
    k1: { referente: "frete", ceg: "Caixa 2 PHP", comunidade: "Comunidade Azul", valor: 18.4, status: "Pendente", prazo: iso(-3), pix: "chave-inventada-123", compOnde: "caminho secreto" },
    k2: { referente: "taxa", ceg: "Set Lua", comunidade: "Comunidade Verde", valor: 9.9, status: "Pendente", prazo: iso(4) }
  },
  caixa: { "app-1": { estado: "lida", registros: [{ destino: "cobrancas", acao: "paga", alvo: "k1", referente: "frete", valor: 18.4, estado: "pendente", confianca: "alta", trecho: "Lari pago" }] } }
};
const PLANILHA = { cadastrada: true, temPlanilha: true, lida: true, achouNome: true, abas: [{ aba: "Frete", cabecalho: "nome;item;valor", linhas: ["Lari;frete;18,40", "Lari;taxa;3,00"], mais: 2 }], cobrancas: [{ id: "k1", achou: true }] };
(async () => {
  const base = `http://127.0.0.1:${srv.address().port}`, b = await chromium.launch(), out = [];
  const ok = (c, m) => { out.push((c ? "ok   " : "FALHA ") + m); if (!c) process.exitCode = 1; };
  for (const [nome, vp] of [["desktop", { width: 1280, height: 900 }], ["celular", { width: 400, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 }); const pg = await ctx.newPage();
    const erros = []; pg.on("pageerror", e => erros.push(e.message)); pg.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    for (const p of ["**/backend.js", "**/@supabase/**"]) await pg.route(p, r => r.fulfill({ contentType: "application/javascript", body: "" }));
    await pg.route("**/fonts.g*/**", r => r.abort());
    const pedidos = []; let invCorpo = null;
    await pg.route("**/api/rodada", async r => { const c = JSON.parse(r.request().postData()); pedidos.push(c); await new Promise(x => setTimeout(x, 150)); r.fulfill({ contentType: "application/json", body: JSON.stringify(PLANILHA) }); });
    await pg.route("**/api/investigar", async r => { invCorpo = JSON.parse(r.request().postData()); r.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "app-1", resumo: "frete pago", ceg: { nome: "Caixa 2 PHP", comunidade: "Comunidade Azul", gom: "Gabi", ondeOlhar: "Grupo Azul Caixa 2" }, totalDevido: 0, semValor: 0, candidatas: [], pergunta: "", registros: [{ destino: "cobrancas", acao: "paga", alvo: "k1", referente: "frete", valor: 18.4, estado: "pendente", confianca: "alta", trecho: "Lari pago" }] }) }); });
    await pg.addInitScript(`window.__seedExtra=${JSON.stringify(extra)}`);
    await pg.addInitScript({ path: __dirname + "/banco-falso.js" });
    await pg.goto(base + "/#agora"); await pg.waitForSelector(".rdbtn");
    const g = async (col, id) => pg.evaluate(([c, i]) => window.__store[c].get(i), [col, id]);
    const btxt = await pg.locator(".rdbtn").innerText();
    ok(/Começar a rodada/.test(btxt) && /CEGs? em \d comunidades?/.test(btxt) && /1 já conferida hoje/.test(btxt), `${nome}: botão na Agora (${btxt.replace(/\n/g, " | ")})`);
    // CEGs: lista com "conferida há N dias" / "hoje"
    await pg.goto(base + "/#cegs"); await pg.reload(); await pg.waitForSelector("#gq"); await pg.fill("#gq", "a"); await pg.waitForTimeout(600); await pg.waitForSelector("button.ceg");
    const lista = await pg.locator("#main").innerText();
    ok(/conferida há 12 dias/.test(lista) && /conferida hoje/.test(lista) && /conferida há 3 dias/.test(lista), `${nome}: lista de CEGs mostra conferida hoje / há N dias`);
    await pg.goto(base + "/#agora"); await pg.reload(); await pg.waitForSelector(".rdbtn");
    // intro
    await pg.click(".rdbtn"); await pg.waitForSelector("[data-rdgo]");
    let sh = await pg.locator("#shB").innerText();
    ok(/CEGs/.test(sh) && /comunidades/.test(sh) && /R\$\s?28,30/.test(sh), `${nome}: intro com total devido (${sh.split("\n").slice(0, 3).join(" | ")})`);
    ok(!/Hoje Já/.test(sh) && /já foi conferida hoje/.test(sh), `${nome}: CEG conferida hoje fica de fora`);
    ok(await pg.locator("#shB .row .av").count() >= 3, `${nome}: comunidades com ícone`);
    await pg.screenshot({ path: `/tmp/rodada-intro-${nome}.png` });
    await pg.click("[data-rdgo]"); await pg.waitForSelector(".rdact");
    // 1ª CEG: a da cobrança vencida (risco), com grupo, GOM + comunidade, planilha, sem pix
    sh = await pg.locator("#shB").innerText();
    ok(/1 de 3/.test(sh) && /Caixa 2 PHP/.test(sh), `${nome}: 1ª CEG é a da cobrança vencida`);
    const tags = await pg.locator("#shB .gtag").evaluateAll(els => els.map(e => ({ av: !!e.querySelector(".av"), com: e.querySelector(".gtc")?.textContent, gom: e.querySelector(".gtg")?.textContent })));
    ok(tags.length >= 1 && tags.every(t => t.av && t.com && t.gom), `${nome}: GOM sempre com ícone + comunidade`);
    ok(await pg.locator("#shB .origem .av").count() >= 1, `${nome}: foto do grupo/ícone da CEG`);
    ok(/frete/.test(sh) && /R\$\s?18,40/.test(sh) && /venceu há 3 dias/.test(sh), `${nome}: cobrança aberta com valor e prazo`);
    ok(/Com a GOM no Brasil|com a GOM/i.test(sh) || /claim/.test(sh), `${nome}: itens por fase`);
    await pg.waitForFunction(() => /Lari;frete;18,40/.test(document.querySelector("#shB").innerText));
    sh = await pg.locator("#shB").innerText();
    ok(pedidos.length === 1 && pedidos[0].ceg === "Caixa 2 PHP" && pedidos[0].comunidade === "Comunidade Azul", `${nome}: pediu a planilha da CEG certa`);
    ok(/na planilha/.test(sh) && /Grupo Azul Caixa 2/.test(sh) && /\+ 2 linhas/.test(sh), `${nome}: mostra o que a planilha diz e onde olhar`);
    ok(!/chave-inventada|caminho secreto|pix/i.test(sh), `${nome}: sem pix nem caminho de comprovante`);
    await pg.screenshot({ path: `/tmp/rodada-ceg-${nome}.png` });
    // Nada novo + desfazer
    await pg.click('[data-rdnada="nada"]'); await pg.waitForFunction(() => /2 de 3/.test(document.querySelector("#shB").innerText));
    ok((await g("cegs", "g1")).conferidoEm === iso(0), `${nome}: 'Nada novo' marca conferidoEm = hoje`);
    ok((await g("cegs", "g1")).nome === "Caixa 2 PHP" && (await g("cegs", "g1")).grupo === "Grupo Azul Caixa 2", `${nome}: só mexeu em conferidoEm`);
    await pg.click(".rdund"); await pg.waitForFunction(() => /1 de 3/.test(document.querySelector("#shB").innerText));
    ok((await g("cegs", "g1")).conferidoEm === iso(-12), `${nome}: desfazer volta a data e a CEG`);
    // Tem novidade: colar mensagem, ler (só sugere), aceitar
    await pg.click("[data-rdnov]"); await pg.fill("#rdt", "Lari pagou o frete da caixa 2"); await pg.click("[data-rdler]");
    await pg.waitForSelector("#shB [data-cxa=aceitar]");
    ok(invCorpo && invCorpo.texto.includes("pagou o frete") && invCorpo.cegForcada === "ceg-g1", `${nome}: manda a mensagem pro robô com a CEG já escolhida`);
    ok((await g("cobrancas", "k1")).status === "Pendente", `${nome}: o robô só sugere, nada mudou ainda`);
    ok(/frete/.test(await pg.locator("#shB .reg").innerText()), `${nome}: sugestão com aceitar/descartar`);
    await pg.screenshot({ path: `/tmp/rodada-novidade-${nome}.png` });
    await pg.click("#shB [data-cxa=aceitar]"); await pg.waitForTimeout(400);
    ok((await g("cobrancas", "k1")).status === "Paga", `${nome}: aceitar grava (fluxo existente)`);
    await pg.click('[data-rdnada="anotei"]'); await pg.waitForFunction(() => /2 de 3/.test(document.querySelector("#shB").innerText));
    ok((await g("cegs", "g1")).conferidoEm === iso(0), `${nome}: 'Pronto, anotei' marca a CEG conferida`);
    // 2ª CEG: Set Lua (cobrança a vencer + envio liberado), sem planilha; Paguei com a conta
    sh = await pg.locator("#shB").innerText();
    ok(/Set Lua/.test(sh) && /não tem planilha/i.test(sh) && /Grupo Verde Lua/.test(sh), `${nome}: CEG sem planilha avisa e mostra onde olhar`);
    ok(/envio liberado/i.test(sh), `${nome}: item com envio liberado aparece`);
    await pg.click('.rdact [data-cst]'); await pg.waitForTimeout(350);
    ok((await g("cobrancas", "k2")).status === "Paga", `${nome}: 'Paguei' reaproveita o fluxo existente`);
    await pg.click(".undo"); await pg.waitForTimeout(300);
    ok((await g("cobrancas", "k2")).status === "Pendente", `${nome}: desfazer o Paguei`);
    // Pular não grava
    await pg.click("[data-rdpular]"); await pg.waitForFunction(() => /3 de 3/.test(document.querySelector("#shB").innerText));
    ok((await g("cegs", "g4")).conferidoEm === iso(-3), `${nome}: 'Pular' não grava nada`);
    // 3ª: Set Seung (Outra): Nada novo -> placar
    await pg.click('[data-rdnada="nada"]'); await pg.waitForSelector(".rdsum.big");
    sh = await pg.locator("#shB").innerText();
    ok(/2 de 3/.test(sh) && /sem novidade/i.test(sh) && /com novidade/i.test(sh) && /ficaram pra depois/i.test(sh) && /Set Lua/.test(sh), `${nome}: placar com conferidas, o que mudou e o que ficou (${sh.replace(/\n/g, " | ").slice(0, 160)})`);
    ok(/R\$\s?9,90/.test(sh) && /pagas agora/i.test(sh) && /1 \(R\$\s?18,40\)/.test(sh), `${nome}: placar com quanto devo e o que foi pago`);
    ok(await pg.locator("#shB .gtag .av").count() >= 1, `${nome}: GOM do placar com ícone + comunidade`);
    await pg.screenshot({ path: `/tmp/rodada-placar-${nome}.png` });
    await pg.click(".sh-b [data-rddesf], #shB [data-rddesf]"); await pg.waitForFunction(() => /3 de 3/.test(document.querySelector("#shB").innerText));
    ok((await g("cegs", "g3")).conferidoEm === undefined || (await g("cegs", "g3")).conferidoEm === null, `${nome}: desfazer até no placar`);
    ok(erros.length === 0, `${nome}: sem erro no console ${erros.join(" | ")}`);
    await ctx.close();
  }
  console.log(out.join("\n")); await b.close(); srv.close();
})();

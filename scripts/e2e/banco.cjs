// Script de início dos e2e: o banco falso, no modelo antigo ("docs", padrão) ou no novo
// ("v2", com E2E_MODELO=v2). Uso nos testes: await pg.addInitScript(require("./banco.cjs"));
const fs = require("fs"), path = require("path");
const modelo = process.env.E2E_MODELO === "v2" ? "v2" : "docs";
module.exports = { content: `window.__MODELO=${JSON.stringify(modelo)};\n` + fs.readFileSync(path.join(__dirname, "banco-falso.js"), "utf8") };

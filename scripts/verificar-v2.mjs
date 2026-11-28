// Compara o app atual (tabela "docs") com o modelo novo (tabelas v2) e FALHA
// (código 1) se algo divergir: contagem por coleção, total devido, total pago,
// itens por CEG, fotos e o conteúdo de cada registro (sem pix).
//
//   npm run verificar-v2
//
// Serve para o dia da migração: rodar depois do --apply e antes de ligar o
// DATA_MODEL=v2. Depois que o app novo for usado, os dois lados passam a
// divergir de propósito (aí o certo é "voltar-v2", não este).
import { paraDocs, semPix, COLS_DOCS } from "./v2/mapear.mjs";
import { conectar } from "./v2/rest-admin.mjs";
import { verificar } from "./v2/verificar-core.mjs";

const sb = conectar();
const docs = await sb.lerDocs();
const T = await sb.lerTabelas();
const r = verificar(docs, T);
for (const l of r.linhas) console.log(l);
console.log(r.ok ? "\nTUDO IGUAL: o modelo novo tem o mesmo que o antigo." : `\nDIVERGE: ${r.problemas} problema(s). Não ligue o v2 antes de resolver (veja docs/MIGRACAO.md, "Se a verificação falhar").`);
process.exit(r.ok ? 0 : 1);

// Volta do modelo novo para o antigo: copia o que está nas tabelas v2 para a
// tabela "docs", pra o app voltar ao modelo antigo (dataModel "docs" no
// config.js e DATA_MODEL=docs na Vercel) com tudo que você fez no v2.
//
//   npm run voltar-v2                 só mostra o que mudaria
//   npm run voltar-v2 -- --apply      grava em "docs" (cria e atualiza)
//   --apagar                          também apaga de "docs" o que você apagou no v2
//
// O pix e o caminho de comprovante que já estavam em "docs" são mantidos (o v2
// nunca os teve). Registro que existe só no v2 é criado em "docs".
import { conectar } from "./v2/rest-admin.mjs";
import { planoDeVolta } from "./v2/verificar-core.mjs";

const aplicar = process.argv.includes("--apply"), apagar = process.argv.includes("--apagar");
const sb = conectar();
const docs = await sb.lerDocs();
const T = await sb.lerTabelas();
const plano = planoDeVolta(docs, T);

if (!plano.temV2) { console.error("As tabelas do modelo novo estão vazias: nada pra voltar. (Se você nunca migrou, está tudo no antigo mesmo.)"); process.exit(1); }
console.log(`Para voltar ao modelo antigo:\n  criar    ${plano.criar.length}\n  atualizar ${plano.atualizar.length}\n  igual    ${plano.iguais}\n  só no antigo (você apagou no v2?) ${plano.sobrando.length}${apagar ? " -> serão apagados" : " -> ficam (use --apagar pra apagar)"}`);
if (!aplicar) { console.log("\nNada foi gravado. Para gravar: npm run voltar-v2 -- --apply"); process.exit(0); }

const lote = [...plano.criar, ...plano.atualizar].map((x) => ({ owner: sb.owner, col: x.col, id: x.id, data: x.data }));
for (let i = 0; i < lote.length; i += 500)
  await sb.rest("docs?on_conflict=owner,col,id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(lote.slice(i, i + 500)) });
if (apagar) for (const x of plano.sobrando) await sb.rest(`docs?owner=eq.${sb.owner}&col=eq.${encodeURIComponent(x.col)}&id=eq.${encodeURIComponent(x.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
console.log(`\nPronto: ${lote.length} registros gravados em "docs"${apagar ? `, ${plano.sobrando.length} apagados` : ""}.\nAgora troque dataModel para "docs" no config.js e DATA_MODEL para docs na Vercel.`);

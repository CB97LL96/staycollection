// Migra os dados do app atual (tabela "docs") para as tabelas novas
// (supabase/v2.sql). Não apaga nem muda nada em "docs".
//
//   npm run migrar-v2              só mostra o relatório (não grava nada)
//   npm run migrar-v2 -- --apply   grava as tabelas novas
//   --criar-por-citacao            CEG/comunidade citada sem cadastro vira cadastro
//                                  (padrão: só avisa; o nome fica no registro)
//
// Rodar de novo é seguro: linha que já existe nas tabelas novas é ignorada
// (nunca sobrescreve o que você já editou no app novo).
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID
// (Supabase > Authentication > Users > User UID).
import { mapear, ORDEM, pkVal } from "./v2/mapear.mjs";
import { conectar, conflitoDe, porColunas } from "./v2/rest-admin.mjs";

const aplicar = process.argv.includes("--apply");
const criar = process.argv.includes("--criar-por-citacao");
const sb = conectar();

const docs = await sb.lerDocs();
const { tabelas, relatorio: r } = mapear(docs, { criar });
// o que já existe nas tabelas novas (rodar de novo não duplica nem sobrescreve)
const T = await sb.lerTabelas(ORDEM);
const jaTem = (t, linha) => T[t].some((x) => pkVal(t, x) === pkVal(t, linha));

const lista = (xs) => (xs.length ? [...new Set(xs)].join("; ") : "nenhuma");
console.log(`Li ${docs.length} registros do app atual.\n`);
console.log("Tabela            novas   já existem (ficam como estão)");
let novas = 0;
const gravar = {};
for (const k of ORDEM) {
  gravar[k] = tabelas[k].filter((l) => !jaTem(k, l));
  novas += gravar[k].length;
  console.log(`  ${k.padEnd(14)} ${String(gravar[k].length).padStart(5)}   ${String(tabelas[k].length - gravar[k].length).padStart(5)}`);
}
console.log(`\nItens sem card do catálogo: ${r.itensSemCard}`);
console.log(`Cards com cópia repetida: ${r.repetidos}`);
console.log(`Registros com pix ou caminho de comprovante (ficam só no app antigo, não vão pro novo): ${r.semPix}`);
console.log(`Comunidades citadas sem cadastro${criar ? " (criadas)" : " (não criadas; o nome fica no registro)"}: ${lista(criar ? r.criadas.comunidades : r.citadas.comunidades)}`);
console.log(`CEGs citadas sem cadastro${criar ? " (criadas)" : " (não criadas; o nome fica no registro)"}: ${lista(criar ? r.criadas.cegs : r.citadas.cegs)}`);
console.log(`GOMs que só apareciam em CEG ou envio (criadas): ${lista(r.criadas.goms)}`);
console.log(`CEGs com o mesmo nome em mais de uma comunidade (conferir): ${lista(r.cegAmbigua)}`);
console.log(`Valores que não consegui ler: ${lista(r.valoresEstranhos)}`);

if (!aplicar) {
  console.log(`\nNada foi gravado (${novas} linhas novas esperariam). Para gravar: npm run migrar-v2 -- --apply`);
  process.exit(0);
}

for (const k of ORDEM) {
  const linhas = gravar[k].map((x) => ({ ...x, owner: sb.owner }));
  for (const grupo of porColunas(linhas))
    for (let i = 0; i < grupo.length; i += 500)
      await sb.rest(`${k}?on_conflict=${conflitoDe(k)}`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(grupo.slice(i, i + 500)) });
  console.log(`gravado: ${k} (${linhas.length})`);
}
console.log("\nPronto. O app atual continua igual; as tabelas novas estão preenchidas.\nPróximo passo: npm run verificar-v2");

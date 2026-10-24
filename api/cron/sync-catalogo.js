// Cron do Vercel: confere o CraftenSKZ, grava item novo no Supabase
// (catalogo_itens) e comita o colecao.json atualizado no GitHub — isso
// dispara um redeploy normal, que é como o arquivo estático que o app lê
// fica atualizado (a Vercel não deixa gravar arquivo em runtime).
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables), além
// das já usadas em api/ler.js:
//   SUPABASE_SERVICE_ROLE_KEY  Supabase > Project Settings > API (secreta;
//                              NUNCA a mesma chave "anon" do config.js)
//   GITHUB_TOKEN   personal access token com permissão de escrita
//                  (Contents: Read and write) neste repositório
//   GITHUB_REPO    "usuario/repositorio" (ex.: CB97LL96/staycollection)
//   CRON_SECRET    qualquer texto secreto; a Vercel manda esse valor como
//                  Authorization: Bearer automaticamente pra cron jobs
//                  configurados em vercel.json (ver "Securing cron jobs"
//                  na documentação da Vercel)
import { conferirCobrancas } from "../../scripts/conferir-cobrancas.mjs";
import { buscarNovosCraftenSKZ, supabaseIdsConhecidos, supabaseInserirItens, gerarColecaoJson } from "../../scripts/catalogo-core.mjs";

async function comitarNoGithub(repo, token, conteudo) {
  const base = `https://api.github.com/repos/${repo}/contents/colecao.json`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
  const atualR = await fetch(base, { headers });
  if (!atualR.ok) throw new Error(`GitHub (ler sha): HTTP ${atualR.status} ${await atualR.text()}`);
  const { sha } = await atualR.json();
  const putR = await fetch(base, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Catálogo: sincroniza com o CraftenSKZ (automático)",
      content: Buffer.from(conteudo).toString("base64"),
      sha,
    }),
  });
  if (!putR.ok) throw new Error(`GitHub (gravar): HTTP ${putR.status} ${await putR.text()}`);
}

async function sincronizarCatalogo() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN;
  if (!url || !key || !repo || !token) throw new Error("Faltam variáveis de ambiente (Supabase e/ou GitHub).");
  const idsConhecidos = await supabaseIdsConhecidos(url, key);
  const novos = await buscarNovosCraftenSKZ(idsConhecidos);
  if (!novos.length) return { novos: 0 };
  await supabaseInserirItens(url, key, novos);
  const colecao = await gerarColecaoJson(url, key);
  await comitarNoGithub(repo, token, JSON.stringify(colecao));
  return { novos: novos.length, itens: novos.map((i) => i.i) };
}

// Este cron roda todo dia e faz duas coisas independentes: o catálogo e a
// conferência das cobranças com as planilhas das GOMs (scripts/conferir-cobrancas.mjs).
// Uma falhar não impede a outra. (Plano Hobby da Vercel: máximo 2 crons, por isso
// a conferência entra aqui em vez de ter um cron só dela.)
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();
  const out = {};
  try { out.catalogo = await sincronizarCatalogo(); } catch (e) { console.error(e); out.catalogo = { erro: e.message }; }
  if (process.env.OWNER_ID && process.env.ANTHROPIC_API_KEY) {
    try {
      const nomes = (process.env.MEUS_NOMES || "").split(",").map((s) => s.trim()).filter(Boolean);
      out.cobrancas = await conferirCobrancas(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.OWNER_ID, { nomes });
    } catch (e) { console.error(e); out.cobrancas = { erro: e.message }; }
  } else out.cobrancas = { pulado: "falta OWNER_ID ou ANTHROPIC_API_KEY" };
  const falhou = Object.values(out).some((v) => v && v.erro);
  return res.status(falhou ? 500 : 200).json(out);
}

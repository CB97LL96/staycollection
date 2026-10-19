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

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();

  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN;
  if (!url || !key || !repo || !token) return res.status(500).json({ erro: "Faltam variáveis de ambiente (Supabase e/ou GitHub)." });

  try {
    const idsConhecidos = await supabaseIdsConhecidos(url, key);
    const novos = await buscarNovosCraftenSKZ(idsConhecidos);
    if (!novos.length) return res.status(200).json({ novos: 0 });

    await supabaseInserirItens(url, key, novos);
    const colecao = await gerarColecaoJson(url, key);
    await comitarNoGithub(repo, token, JSON.stringify(colecao));
    return res.status(200).json({ novos: novos.length, itens: novos.map((i) => i.i) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: e.message });
  }
}

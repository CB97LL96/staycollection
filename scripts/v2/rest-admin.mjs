// Acesso de administrador (chave service_role) ao Supabase, só para os scripts
// de migração: migrar-v2, verificar-v2 e voltar-v2. Nunca roda no navegador.
import "../../v2-codec.js";

const C = globalThis.StayV2;

export function conectar({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, owner = process.env.OWNER_ID } = {}) {
  if (!url || !key || !owner) {
    console.error("Faltam variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e OWNER_ID (veja docs/MIGRACAO.md).");
    process.exit(1);
  }
  async function rest(path, opts = {}) {
    const r = await fetch(`${url}/rest/v1/${path}`, { ...opts, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`Supabase ${path.split("?")[0]}: HTTP ${r.status} ${await r.text()}`);
    const t = await r.text();
    return t.trim() ? JSON.parse(t) : null;
  }
  async function paginas(caminho) {
    const out = [];
    for (let de = 0; ; de += 1000) {
      const pg = (await rest(`${caminho}${caminho.includes("?") ? "&" : "?"}limit=1000&offset=${de}`)) || [];
      out.push(...pg);
      if (pg.length < 1000) return out;
    }
  }
  return {
    url, owner, rest,
    lerDocs: () => paginas(`docs?owner=eq.${owner}&select=col,id,data&order=col,id`),
    async lerTabelas(tabs = C.TABELAS) {
      const T = {};
      for (const t of tabs) T[t] = await paginas(`${t}?owner=eq.${owner}&select=*`);
      return T;
    },
  };
}

// conflito de cada tabela (chave primária com o dono, quando a tabela tem dono na chave)
export const CONFLITO = { binder_meta: "owner", posse: "owner,card_id", card_fotos: "owner,card_id", meta: "owner,chave", avulsos: "owner,col,id" };
export const conflitoDe = (t) => CONFLITO[t] || "id";

// agrupa linhas com as mesmas colunas (o PostgREST exige o mesmo conjunto em cada gravação)
export function porColunas(linhas) {
  const g = new Map();
  for (const l of linhas) { const k = Object.keys(l).sort().join(","); if (!g.has(k)) g.set(k, []); g.get(k).push(l); }
  return [...g.values()];
}

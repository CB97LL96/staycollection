// A camada de dados do servidor (api/*.js, crons e scripts/*.mjs): lê e grava
// os "documentos" do app (coleção + id + JSON) no modelo certo, escolhido
// pela variável DATA_MODEL ("docs", padrão, ou "v2"). Quem chama não precisa
// saber qual é: o formato é o mesmo do app (index.html).
//
//   const s = abrirStore({ url, key, owner });
//   await s.lerDocs(["cegs", "itens"])   // [{ col, id, data }]
//   await s.pegar("caixa", id)           // data | null
//   await s.gravar("caixa", id, data)    // grava o documento inteiro
//   await s.mesclar("itens", id, patch, { robo: true })  // junta campos; não mexe no que ela travou
//   await s.criar("cobrancas", data)     // id novo (10 hex, como o app)
//   await s.apagar("caixa", id)
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID, DATA_MODEL.
import { randomBytes } from "node:crypto";
import "../../v2-codec.js";

const C = globalThis.StayV2;
const id10 = () => randomBytes(5).toString("hex");

export const modeloAtual = () => (String(process.env.DATA_MODEL || "").toLowerCase() === "v2" ? "v2" : "docs");

export function abrirStore({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, owner = process.env.OWNER_ID, modelo = modeloAtual(), hoje } = {}) {
  const rest = async (path, opts = {}) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { ...opts, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`Supabase ${path.split("?")[0]}: HTTP ${r.status} ${await r.text()}`);
    // Com return=minimal, atualizar um registro que já existe volta 200 sem corpo.
    const t = await r.text();
    return t.trim() ? JSON.parse(t) : null;
  };
  const enc = encodeURIComponent;
  const travadosDe = (d) => (Array.isArray(d && d.travado) ? d.travado : []);

  // quais campos o robô pode mexer: o que ela travou fica como está
  function protegido(atual, patch, robo) {
    if (!robo || !atual) return { final: { ...atual, ...patch }, ignorados: [] };
    const t = new Set(travadosDe(atual)), ignorados = [], final = { ...atual };
    for (const [k, v] of Object.entries(patch)) { if (t.has(k) && JSON.stringify(atual[k]) !== JSON.stringify(v)) ignorados.push(k); else final[k] = v; }
    return { final, ignorados };
  }

  if (modelo !== "v2") {
    const f = (col, id) => `docs?owner=eq.${owner}&col=eq.${enc(col)}&id=eq.${enc(id)}`;
    return {
      modelo, owner,
      async lerDocs(cols) { return rest(`docs?owner=eq.${owner}&col=in.(${cols.join(",")})&select=col,id,data&limit=10000`); },
      async listar(col) { return (await rest(`docs?owner=eq.${owner}&col=eq.${enc(col)}&select=id,data&limit=10000`)) || []; },
      async pegar(col, id) { const [r] = (await rest(`${f(col, id)}&select=data`)) || []; return r ? r.data : null; },
      async gravar(col, id, data) { await rest("docs?on_conflict=owner,col,id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ owner, col, id, data }) }); },
      async criar(col, data, id = id10()) { await rest("docs", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ owner, col, id, data }) }); return id; },
      // grava só os que ainda não existem (nunca sobrescreve): [{ id, data }]
      async semear(col, itens) { if (itens.length) await rest("docs?on_conflict=owner,col,id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(itens.map((x) => ({ owner, col, id: x.id, data: x.data }))) }); },
      async mesclar(col, id, patch, { robo = false } = {}) {
        const atual = await this.pegar(col, id); if (!atual) return { ok: false, ignorados: [] };
        const { final, ignorados } = protegido(atual, patch, robo);
        await rest(f(col, id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: final }) });
        return { ok: true, ignorados };
      },
      async apagar(col, id) { await rest(f(col, id), { method: "DELETE", headers: { Prefer: "return=minimal" } }); },
    };
  }

  // ---------- modelo v2: tabelas ligadas por id ----------
  const T = {}; C.TABELAS.forEach((t) => { T[t] = new Map(); });
  const lidas = new Set();
  async function lerTab(tab) {
    if (lidas.has(tab)) return;
    for (let de = 0; ; de += 1000) {
      const pg = (await rest(`${tab}?owner=eq.${owner}&select=*&limit=1000&offset=${de}`)) || [];
      pg.forEach((r) => T[tab].set(C.pkVal(tab, r), r));
      if (pg.length < 1000) break;
    }
    lidas.add(tab);
  }
  const preciso = (col) => [...new Set([...C.tabelasDe(col), "comunidades", "goms", "cegs", "itens", "provas"])];
  const carregar = (cols) => Promise.all([...new Set(cols.flatMap(preciso))].map(lerTab));
  const docsDe = (col) => C.paraDocs(T, [col])[col] || new Map();
  async function aplicar(r) {
    const up = Object.entries(r.up || {}), del = Object.entries(r.del || {});
    if (!up.length && !del.length) return;
    await rest("rpc/v2_aplicar", { method: "POST", body: JSON.stringify({ p: { up, del }, p_owner: owner }) });
    up.forEach(([tab, rows]) => rows.forEach((row) => { const k = C.pkVal(tab, row); T[tab].set(k, { ...(T[tab].get(k) || {}), ...row }); }));
    del.forEach(([tab, rows]) => rows.forEach((row) => T[tab].delete(C.pkVal(tab, row))));
  }
  return {
    modelo, owner,
    async lerDocs(cols) {
      await carregar(cols);
      const todos = C.paraDocs(T, cols);
      return cols.flatMap((col) => [...(todos[col] || new Map())].map(([id, data]) => ({ col, id, data })));
    },
    async listar(col) { await carregar([col]); return [...docsDe(col)].map(([id, data]) => ({ id, data })); },
    async pegar(col, id) { await carregar([col]); return docsDe(col).get(String(id)) || null; },
    async gravar(col, id, data) { await carregar([col]); await aplicar(C.escrever(col, String(id), data, T, { hoje })); },
    async criar(col, data, id = id10()) { await this.gravar(col, id, data); return id; },
    async semear(col, itens) { await carregar([col]); const tem = docsDe(col); for (const x of itens) if (!tem.has(String(x.id))) await this.gravar(col, x.id, x.data); },
    async mesclar(col, id, patch, { robo = false } = {}) {
      const atual = await this.pegar(col, id); if (!atual) return { ok: false, ignorados: [] };
      const { final, ignorados } = protegido(atual, patch, robo);
      await aplicar(C.escrever(col, String(id), final, T, { hoje }));
      return { ok: true, ignorados };
    },
    async apagar(col, id) { await carregar([col]); await aplicar(C.apagarDoc(col, String(id), T, { hoje })); },
  };
}

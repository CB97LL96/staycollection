// Um Supabase (PostgREST) falso, em memória, para os testes do servidor
// (api/*.js, conferir-*.mjs, aceitar.mjs). Entende os dois modelos:
//   "docs": a tabela genérica docs (col, id, data);
//   "v2":   as tabelas do v2.sql e a função v2_aplicar.
// Nos dois, banco.docs mostra os documentos como o app os vê ("col/id" -> data),
// então a mesma verificação serve para os dois modelos. Dados inventados.
import "../../v2-codec.js";

const C = globalThis.StayV2;

export function criarBanco(modelo, docsIniciais = [], owner = "dono") {
  const docs = new Map(docsIniciais.map((d) => [`${d.col}/${d.id}`, JSON.parse(JSON.stringify(d.data))]));
  const T = {}; C.TABELAS.forEach((t) => { T[t] = new Map(); });
  if (modelo === "v2") {
    const { tabelas } = C.mapear(docsIniciais);
    for (const t in tabelas) tabelas[t].forEach((r) => T[t].set(C.pkVal(t, r), { ...r, owner }));
  }
  const chamadas = [];
  const resp = (corpo, status = 200) => ({ ok: status < 400, status, text: async () => (corpo == null ? "" : typeof corpo === "string" ? corpo : JSON.stringify(corpo)), json: async () => corpo });
  const filtro = (p, k) => { const v = p.get(k); return v == null ? null : v; };
  const igual = (v) => (v == null ? null : v.replace(/^eq\./, ""));

  function aplicar(p) {
    (p.up || []).forEach(([tab, rows]) => rows.forEach((r) => { const k = C.pkVal(tab, r); T[tab].set(k, { ...(T[tab].get(k) || {}), ...r, owner }); }));
    (p.del || []).forEach(([tab, rows]) => rows.forEach((r) => T[tab].delete(C.pkVal(tab, r))));
  }

  async function rest(url, opts = {}) {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/rest\/v1\//, ""), p = u.searchParams, metodo = opts.method || "GET";
    chamadas.push({ metodo, path, corpo: opts.body ? JSON.parse(opts.body) : null });
    if (modelo === "docs") {
      if (path !== "docs") return resp({ message: "tabela desconhecida " + path }, 404);
      const col = igual(filtro(p, "col")), id = igual(filtro(p, "id"));
      const cols = (filtro(p, "col") || "").startsWith("in.") ? filtro(p, "col").slice(4, -1).split(",") : null;
      const casa = (k) => { const [c, i] = [k.slice(0, k.indexOf("/")), k.slice(k.indexOf("/") + 1)]; return (cols ? cols.includes(c) : !col || c === col) && (!id || i === id); };
      if (metodo === "GET") return resp([...docs].filter(([k]) => casa(k)).map(([k, data]) => ({ col: k.slice(0, k.indexOf("/")), id: k.slice(k.indexOf("/") + 1), data })));
      const corpo = JSON.parse(opts.body || "null"), prefer = (opts.headers && opts.headers.Prefer) || "";
      if (metodo === "POST") {
        for (const r of Array.isArray(corpo) ? corpo : [corpo]) {
          const k = `${r.col}/${r.id}`;
          if (docs.has(k)) { if (prefer.includes("ignore-duplicates")) continue; if (!prefer.includes("merge-duplicates")) return resp("duplicate", 409); }
          docs.set(k, r.data);
        }
        return resp(null);
      }
      if (metodo === "PATCH") { docs.set(`${col}/${id}`, corpo.data); return resp(null); }
      if (metodo === "DELETE") { docs.delete(`${col}/${id}`); return resp(null); }
      return resp(null);
    }
    // ---- v2 ----
    if (path === "rpc/v2_aplicar") { aplicar(JSON.parse(opts.body).p); return resp(null); }
    if (metodo === "GET" && T[path]) {
      const lim = Number(filtro(p, "limit") || 1000), off = Number(filtro(p, "offset") || 0);
      return resp([...T[path].values()].slice(off, off + lim));
    }
    return resp({ message: "não suportado no v2 falso: " + metodo + " " + path }, 404);
  }

  return {
    modelo, owner, chamadas, rest, T,
    // os documentos como o app os vê
    get docs() {
      if (modelo === "docs") return docs;
      const out = new Map(); const todos = C.paraDocs(T);
      for (const col in todos) for (const [id, data] of todos[col]) out.set(`${col}/${id}`, data);
      return out;
    },
    // instala como o fetch do Node (só para o Supabase); o resto passa para "outro"
    instalar(outro) {
      globalThis.fetch = async (url, opts = {}) => (new URL(url).pathname.startsWith("/rest/v1/") ? rest(url, opts) : outro(url, opts));
    },
  };
}

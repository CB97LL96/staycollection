// Substitui o banco do artefato do claude.ai (window.claude.use) pelo Supabase,
// com a mesma interface que o index.html já usa: collection().limit().onSnapshot,
// collection().add, doc().set/update/delete/onSnapshot, e upload de fotos.
(function(){
const cfg = window.STAY_CONFIG || {};
const sb = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
  ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
  : null;

let sessionP = null;
const getSession = () => sessionP || (sessionP = sb
  ? sb.auth.getSession().then(r => r.data.session).catch(() => null)
  : Promise.resolve(null));

const cache = new Map();   // coleção -> Map(id -> dados)
const subs = new Map();    // coleção -> Set(função)
const loading = new Map(); // coleção -> Promise
let channel = null;

const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, "0")).join("");
const fail = error => { const e = new Error(error.message || "erro no banco"); e.code = error.code; throw e; };

function emit(col){
  const m = cache.get(col); if (!m) return;
  const docs = [...m].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, d]) => ({ id, data: () => d }));
  (subs.get(col) || []).forEach(fn => { try { fn(docs) } catch (e) { console.error(e) } });
}
function local(col, id, d){
  const m = cache.get(col); if (!m) return;
  if (d === undefined) m.delete(id); else m.set(id, d);
  emit(col);
}
function listen(){
  if (channel) return;
  channel = sb.channel("docs").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, p => {
    const row = p.eventType === "DELETE" ? p.old : p.new;
    if (row && row.col) local(row.col, row.id, p.eventType === "DELETE" ? undefined : row.data);
  }).subscribe();
}
function load(col, lim){
  if (!loading.has(col)) loading.set(col, (async () => {
    const { data, error } = await sb.from("docs").select("id,data").eq("col", col).order("id").range(0, Math.max(lim, 1000) - 1);
    if (error) { loading.delete(col); fail(error); }
    cache.set(col, new Map(data.map(r => [r.id, r.data])));
    listen(); emit(col);
  })());
  else if (cache.has(col)) emit(col);
  return loading.get(col);
}
function subscribe(col, lim, fn, onErr){
  if (!subs.has(col)) subs.set(col, new Set());
  subs.get(col).add(fn);
  load(col, lim).catch(e => onErr && onErr(e));
  return () => subs.get(col).delete(fn);
}

const docRef = path => {
  const i = path.indexOf("/"), col = path.slice(0, i), id = path.slice(i + 1);
  return {
    onSnapshot(cb, onErr){
      return subscribe(col, 1000, () => { const d = cache.get(col).get(id); cb({ exists: d !== undefined, data: () => d }) }, onErr);
    },
    async set(d){
      const { error } = await sb.from("docs").upsert({ col, id, data: d }, { onConflict: "owner,col,id" });
      if (error) fail(error); local(col, id, d);
    },
    async update(patch){
      const { error } = await sb.rpc("doc_merge", { p_col: col, p_id: id, p_patch: patch });
      if (error) fail(error);
      const cur = cache.get(col) && cache.get(col).get(id);
      if (cur) local(col, id, { ...cur, ...patch });
    },
    async delete(){
      const { error } = await sb.from("docs").delete().eq("col", col).eq("id", id);
      if (error) fail(error); local(col, id, undefined);
    },
  };
};
const collectionRef = col => {
  let lim = 1000;
  const q = {
    limit(n){ lim = n; return q },
    onSnapshot(cb, onErr){ return subscribe(col, lim, docs => cb({ docs }), onErr) },
    async add(d){
      const id = hex(10);
      const { error } = await sb.from("docs").insert({ col, id, data: d });
      if (error) fail(error); local(col, id, d);
      return { id };
    },
  };
  return q;
};
const db = { collection: collectionRef, doc: docRef };

const assets = {
  async upload(blob, opts){
    const id = hex(16);
    const { error } = await sb.storage.from("fotos").upload(id, blob, { contentType: (opts && opts.type) || blob.type });
    if (error) fail(error);
    return { id };
  },
  async delete(id){
    const { error } = await sb.storage.from("fotos").remove([id]);
    if (error) fail(error);
  },
};

function showLogin(){
  if (document.getElementById("stay-login")) return;
  const el = document.createElement("div");
  el.id = "stay-login";
  el.innerHTML = `<div class="sl-card"><h2>Coleção SKZ</h2><p>Entre com a sua conta do Google pra ver e editar suas CEGs.</p><button type="button">Entrar com Google</button><small></small></div>`;
  const st = document.createElement("style");
  st.textContent = `#stay-login{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px;background:var(--bg,#FCF5F8)}
#stay-login .sl-card{max-width:360px;width:100%;display:grid;gap:12px;text-align:center;background:var(--surface,#fff);border-radius:22px;padding:28px 20px;box-shadow:var(--shadow,0 8px 22px rgba(0,0,0,.08));color:var(--ink,#2B2233);font-family:var(--f-body,system-ui,sans-serif)}
#stay-login h2{margin:0;font-size:24px}#stay-login p{margin:0;color:var(--ink2,#6E6178)}
#stay-login button{border:none;border-radius:999px;padding:12px 18px;font:inherit;font-weight:700;cursor:pointer;background:var(--accent,#F7B2CF);color:var(--accent-ink,#2B2233)}
#stay-login small{color:var(--bad,#B0305F)}`;
  document.head.appendChild(st);
  el.querySelector("button").onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    if (error) el.querySelector("small").textContent = "Não deu pra entrar: " + error.message;
  };
  document.body.appendChild(el);
}

window.claude = {
  async use(name){
    if (!sb) return null;
    const s = await getSession();
    if (!s) { if (name === "db") showLogin(); return null; }
    if (name === "db") return db;
    if (name === "user") return { can: async () => true };
    if (name === "assets") return assets;
    return null;
  },
};
window.stay = {
  sb, getSession, showLogin,
  blobUrl: id => sb ? sb.storage.from("fotos").getPublicUrl(id).data.publicUrl : "",
};
})();

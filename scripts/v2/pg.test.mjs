// Teste do esquema e da gravação num Postgres de verdade (opcional).
//   PGTEST=1 PGHOST=/tmp PGPORT=5544 PGUSER=postgres node --test scripts/v2/pg.test.mjs
// Sem PGTEST o teste é pulado. Recria o banco "stay_v2_teste" do zero, com um
// stub de auth.users / auth.uid() / storage (o Supabase tem os de verdade).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mapear, paraDocs, escrever, apagarDoc, ORDEM, semPix } from "./mapear.mjs";
import { exemplo } from "./exemplo.mjs";

const ligado = !!process.env.PGTEST;
const DB = "stay_v2_teste", DONO = "11111111-1111-1111-1111-111111111111", OUTRO = "22222222-2222-2222-2222-222222222222";
const psql = (sql, { db = DB, ...o } = {}) => execFileSync("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-d", db], { input: sql, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["pipe", "pipe", "pipe"], ...o });
const arquivo = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const ordenado = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v)));
const lerTudo = () => {
  const T = {};
  for (const t of ORDEM) T[t] = JSON.parse(psql(`select coalesce(json_agg(x), '[]'::json) from public.${t} x`).trim());
  return T;
};
const pacote = (r) => JSON.stringify({ up: Object.entries(r.up || {}), del: Object.entries(r.del || {}) });
const aplicar = (r, owner) => psql(`select public.v2_aplicar($j$${pacote(r)}$j$::jsonb, ${owner ? `'${owner}'` : "null"})`);
const comoUsuario = (uid, sql) => psql(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); ${sql}`);

test("esquema roda duas vezes e o v2_aplicar grava e lê de volta o mesmo documento", { skip: !ligado }, () => {
  psql(`drop database if exists ${DB}`, { db: "postgres" }); psql(`create database ${DB}`, { db: "postgres" });
  psql(arquivo("./pg-stub.sql"));
  psql(arquivo("../../supabase/schema.sql"));
  psql(arquivo("../../supabase/v2.sql")); psql(arquivo("../../supabase/v2.sql"));
  psql(`insert into auth.users(id) values ('${DONO}'), ('${OUTRO}'); grant all on all tables in schema public to authenticated; grant usage on schema auth to authenticated;`);

  // migração: o mesmo caminho do scripts/migrar-v2.mjs --apply
  const { tabelas } = mapear(exemplo);
  aplicar({ up: Object.fromEntries(ORDEM.map((t) => [t, tabelas[t]]).filter(([, v]) => v.length)) }, DONO);
  const volta = paraDocs(lerTudo());
  for (const d of exemplo) assert.deepEqual(ordenado(volta[d.col].get(d.id)), ordenado(semPix(d.data)), `${d.col}/${d.id}`);

  // o app: edita o status de um item como usuário logado (RLS), sem passar p_owner
  const T = lerTudo();
  const atual = paraDocs(T).itens.get("i1");
  const r = escrever("itens", "i1", { ...atual, status: "Recebido" }, T, { hoje: "2026-11-28" });
  comoUsuario(DONO, `select public.v2_aplicar($j$${pacote(r)}$j$::jsonb)`);
  const depois = paraDocs(lerTudo());
  assert.equal(depois.itens.get("i1").status, "Recebido");
  assert.equal(psql("select count(*) from public.item_status").trim(), "2");
  assert.deepEqual(depois.itens.get("i4").travado, ["status"]); // o que ela travou segue travado

  // apagar uma cobrança leva as provas
  aplicar(apagarDoc("cobrancas", "k2", lerTudo()), DONO);
  assert.equal(psql("select count(*) from public.provas where alvo_id='cob-k2'").trim(), "0");

  // RLS: outra pessoa não vê nada e não grava na conta dela
  assert.equal(comoUsuario(OUTRO, "select count(*) from public.itens").trim().split("\n").pop(), "0");
  assert.throws(() => comoUsuario(OUTRO, `select public.v2_aplicar('{"up":[["comunidades",[{"id":"com-c1","nome":"roubada"}]]]}'::jsonb)`));
  assert.equal(psql("select nome from public.comunidades where id='com-c1'").trim(), "Comunidade Azul");

  // tabela fora da lista não passa; e é tudo ou nada
  assert.throws(() => aplicar({ up: { docs: [{ id: "x" }] } }, DONO));
  assert.throws(() => aplicar({ up: { comunidades: [{ id: "com-novo", nome: "N" }], goms: [{ id: "g-ruim", nome: null }] } }, DONO));
  assert.equal(psql("select count(*) from public.comunidades where id='com-novo'").trim(), "0");
});

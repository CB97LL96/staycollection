// A comparação em si (sem rede), pra poder testar. docs: [{col,id,data}],
// T: tabelas do v2 (linhas). Devolve { ok, problemas, linhas }.
import { paraDocs, semPix, norm, valor } from "./mapear.mjs";

const ABERTAS = ["Pendente", "A confirmar", "Aguardando a GOM", "Não liberado"];
const ordenado = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v)));
const cents = (n) => Math.round((Number(n) || 0) * 100);
const brl = (c) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

// o que o app antigo sabe de uma coleção (colecao: só os estados, sem grupos vazios)
function visaoAntiga(docs) {
  const m = {};
  for (const d of docs) { (m[d.col] ||= new Map()).set(String(d.id), semPix(d.data)); }
  if (m.colecao) for (const [k, v] of m.colecao) if (!v.s || !Object.keys(v.s).length) m.colecao.delete(k);
  return m;
}

export function verificar(docs, T) {
  const linhas = []; let problemas = 0;
  const falha = (l) => { problemas++; linhas.push("  FALHA " + l); };
  const ok = (l) => linhas.push("  ok    " + l);
  const antigo = visaoAntiga(docs), novo = paraDocs(T);
  const cols = [...new Set([...Object.keys(antigo), ...Object.keys(novo)])].sort();

  linhas.push("Contagem por coleção (antigo / novo):");
  for (const c of cols) {
    const a = antigo[c] ? antigo[c].size : 0, n = novo[c] ? novo[c].size : 0;
    const extra = c === "colecao" ? " (grupos com algum card marcado)" : "";
    (a === n ? ok : falha)(`${c.padEnd(12)} ${a} / ${n}${extra}`);
  }
  // estados por card (a coleção por dentro)
  const est = (m) => [...(m || new Map())].reduce((s, [, v]) => s + Object.keys(v.s || {}).length, 0);
  (est(antigo.colecao) === est(novo.colecao) ? ok : falha)(`cards marcados na coleção ${est(antigo.colecao)} / ${est(novo.colecao)}`);

  linhas.push("\nDinheiro:");
  const soma = (m, f) => cents([...(m || new Map()).values()].filter(f).reduce((s, d) => s + (valor(d.valor) || 0), 0));
  const devido = (d) => ABERTAS.includes(d.status);
  for (const [nome, f] of [["total devido (cobranças abertas)", devido], ["total pago (cobranças pagas)", (d) => d.status === "Paga"], ["tudo que está em cobranças", () => true]]) {
    const a = soma(antigo.cobrancas, f), n = soma(novo.cobrancas, f);
    (a === n ? ok : falha)(`${nome}: ${brl(a)} / ${brl(n)}`);
  }
  { const a = soma(antigo.repasses, () => true), n = soma(novo.repasses, () => true); (a === n ? ok : falha)(`repasses a receber: ${brl(a)} / ${brl(n)}`); }

  linhas.push("\nItens por CEG (nome + comunidade):");
  const porCeg = (m) => { const o = {}; for (const d of (m || new Map()).values()) { const k = `${norm(d.ceg)}|${norm(d.comunidade)}`; o[k] = (o[k] || 0) + 1; } return o; };
  const A = porCeg(antigo.itens), N = porCeg(novo.itens);
  const difCeg = Object.keys({ ...A, ...N }).filter((k) => A[k] !== N[k]);
  difCeg.length ? difCeg.slice(0, 10).forEach((k) => falha(`${k || "(sem CEG)"}: ${A[k] || 0} / ${N[k] || 0}`)) : ok(`${Object.keys(A).length} CEGs com a mesma quantidade de itens`);

  linhas.push("\nFotos:");
  const ids = (m) => [...(m || new Map())].map(([k, v]) => `${k}:${v.asset || ""}:${v.url || ""}`).sort();
  const fa = ids(antigo.fotos), fn = ids(novo.fotos);
  (JSON.stringify(fa) === JSON.stringify(fn) ? ok : falha)(`${fa.length} fotos no antigo / ${fn.length} no novo, mesmas chaves e arquivos`);
  const compA = [...(antigo.cobrancas || new Map()).values()].filter((d) => d.comprovanteAsset).length, compN = [...(novo.cobrancas || new Map()).values()].filter((d) => d.comprovanteAsset).length;
  (compA === compN ? ok : falha)(`comprovantes anexados ${compA} / ${compN}`);

  linhas.push("\nCada registro (conteúdo, sem pix):");
  let iguais = 0; const difs = [];
  for (const c of cols) for (const [id, a] of antigo[c] || []) {
    const n = (novo[c] || new Map()).get(id);
    if (n && JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(n))) iguais++; else difs.push(`${c}/${id}${n ? "" : " (falta no novo)"}`);
  }
  for (const c of cols) for (const id of (novo[c] || new Map()).keys()) if (!(antigo[c] || new Map()).has(id)) difs.push(`${c}/${id} (só no novo)`);
  difs.length ? (difs.slice(0, 15).forEach((x) => falha(x)), difs.length > 15 && linhas.push(`  ... e mais ${difs.length - 15}`)) : ok(`${iguais} registros iguais`);
  return { ok: problemas === 0, problemas, linhas };
}

// O que fazer em "docs" para ele ficar igual ao v2 (usado pelo voltar-v2).
// Mantém no registro antigo os campos de pix e comprovante, que o v2 nunca guardou.
export function planoDeVolta(docs, T) {
  const novo = paraDocs(T);
  const antigo = new Map(docs.map((d) => [`${d.col}/${d.id}`, d.data]));
  const plano = { temV2: false, criar: [], atualizar: [], iguais: 0, sobrando: [] };
  const vistos = new Set();
  for (const col of Object.keys(novo)) for (const [id, data] of novo[col]) {
    plano.temV2 = true;
    const k = `${col}/${id}`; vistos.add(k);
    const velho = antigo.get(k);
    if (!velho) { plano.criar.push({ col, id, data }); continue; }
    const final = { ...velho, ...data };
    if (JSON.stringify(ordenado(final)) === JSON.stringify(ordenado(velho))) plano.iguais++; else plano.atualizar.push({ col, id, data: final });
  }
  for (const d of docs) {
    const k = `${d.col}/${d.id}`;
    if (vistos.has(k)) continue;
    // grupo da coleção sem nenhum card marcado não existe no v2: fica vazio no antigo
    if (d.col === "colecao") { if (d.data && d.data.s && Object.keys(d.data.s).length) plano.atualizar.push({ col: d.col, id: d.id, data: { ...d.data, s: {} } }); continue; }
    plano.sobrando.push({ col: d.col, id: d.id });
  }
  return plano;
}
export { ordenado };

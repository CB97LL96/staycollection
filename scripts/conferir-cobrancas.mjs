// Confere todo dia as cobranças em aberto com a planilha de cada CEG.
//
// Fluxo: lê as cobranças e as CEGs da usuária no Supabase (tabela docs),
// baixa a planilha de cada CEG (campo "planilha" da CEG), separa as linhas que
// citam o nome dela e pede pra IA (Gemini, scripts/ia.mjs) comparar com as
// cobranças em aberto.
//
// O que grava (só em cobranças em aberto, e só estes campos):
//   - bate com a planilha  -> conferidoEm = hoje (o app mostra "conferido hoje")
//   - não bate             -> status vira "A confirmar" (se estava "Pendente")
//                             e uma linha "[auto dd/mm] ..." entra em obs
//   - não achou o nome     -> não mexe em nada (só conta no resultado)
// Nunca muda valor, prazo nem marca como "Paga" sozinho.
//
// Roda dentro do cron diário (api/cron/sync-catalogo.js). Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, MEUS_NOMES
//   OWNER_ID  uuid da sua conta: Supabase > Authentication > Users > User UID
import { createHash } from "node:crypto";
import { gerarJson } from "./ia.mjs";

const ABERTAS = ["Pendente", "A confirmar", "Aguardando a GOM", "Não liberado"];
const MAX_CHARS = 120000;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resultados", "faltando"],
  properties: {
    faltando: {
      type: "array",
      description: "cobranças dela que a planilha mostra (a pagar, ainda não pagas) e que não estão em nenhuma das cobranças anotadas",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["referente", "tipo", "valor", "prazo", "trecho"],
        properties: {
          referente: { type: "string", description: "curto, nos termos da comunidade (frete inter, taxa, item)" },
          tipo: { type: "string", description: "Item, Frete internacional, Frete nacional, Taxa RF, Armazenamento, Multa ou Outro" },
          valor: { type: ["number", "null"], description: "em reais, como está na linha dela" },
          prazo: { type: "string", description: "AAAA-MM-DD ou vazio" },
          trecho: { type: "string", description: "a linha da planilha, literal" },
        },
      },
    },
    resultados: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "resultado", "nota"],
        properties: {
          id: { type: "string" },
          resultado: { type: "string", enum: ["igual", "diferente", "nao_encontrada"] },
          nota: { type: "string", description: "se diferente: o que a planilha diz (status, valor, prazo), curto; senão vazio" },
        },
      },
    },
  },
};

const SYSTEM = `Você confere cobranças de uma compra coletiva (CEG) de Stray Kids contra a planilha da GOM.
Você recebe as linhas da planilha que citam a pessoa e a lista de cobranças que ela tem anotadas.
Para cada cobrança diga:
- "igual": a planilha mostra essa cobrança com o mesmo valor e a mesma situação (pendente de pagamento, não liberada etc.).
- "diferente": a planilha mostra algo diferente do anotado (já consta como pago, valor outro, prazo outro, cobrança que não existe mais). Explique em "nota", curto, com os números.
- "nao_encontrada": nada na planilha diz respeito a essa cobrança.
Não invente. Na dúvida, use "nao_encontrada".
Resultados só para as cobranças marcadas como ABERTA.
Em "faltando", liste o que a planilha mostra que ela ainda deve e que não corresponde a nenhuma cobrança anotada (aberta ou não). A GOM usa apelidos e números: se uma linha for a mesma coisa que uma cobrança anotada com outro nome, não é faltante. Na dúvida, não liste.`;

const brl = (n) => (typeof n === "number" ? `R$ ${n.toFixed(2).replace(".", ",")}` : "valor não informado");
const ddmm = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

const UA = { "User-Agent": "Mozilla/5.0" };

// Lista as abas visíveis da planilha (nome e gid) pela versão "htmlview",
// que é pública quando a planilha está aberta por link. Abas ocultas não
// aparecem ali, e é de propósito: a GOM esconde o que não vale mais.
async function abasVisiveis(id) {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/htmlview`, { headers: UA });
  if (!r.ok) return [];
  const h = await r.text();
  return [...h.matchAll(/items\.push\(\{name: "((?:[^"\\]|\\.)*)", pageUrl: "[^"]*?gid=(\d+)/g)]
    .map((m) => ({ aba: m[1].replace(/\\(.)/g, "$1"), gid: m[2] }));
}

async function csvDaAba(id, gid) {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`, { redirect: "follow", headers: UA });
  if (!r.ok) throw new Error(`planilha: HTTP ${r.status} (a planilha precisa estar aberta por link)`);
  const t = await r.text();
  if (/<html/i.test(t.slice(0, 500))) throw new Error("planilha pediu login (não está aberta por link)");
  return t;
}

// Baixa a planilha inteira: todas as abas visíveis, não só a primeira (as
// linhas de cada pessoa costumam ficar em abas separadas por loja ou set).
// Devolve [{ aba, texto }].
export async function baixarPlanilha(link) {
  const id = (String(link || "").match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/) || [])[1];
  if (!id) {
    const r = await fetch(link, { redirect: "follow", headers: UA });
    if (!r.ok) throw new Error(`planilha: HTTP ${r.status}`);
    const t = (await r.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ");
    return [{ aba: "", texto: t }];
  }
  const abas = await abasVisiveis(id);
  if (!abas.length) return [{ aba: "", texto: await csvDaAba(id, (String(link).match(/[#&?]gid=(\d+)/) || [])[1] || "0") }];
  const out = [];
  for (const a of abas.slice(0, 60)) out.push({ aba: a.aba, texto: await csvDaAba(id, a.gid) });
  return out;
}

// Por aba: cabeçalho + só as linhas que citam algum dos nomes dela.
export function linhasDela(abas, nomes) {
  const nm = nomes.map((n) => n.toLowerCase()).filter(Boolean);
  return abas.map(({ aba, texto }) => {
    const linhas = texto.split(/\r?\n/);
    return { aba, cabecalho: linhas.slice(0, 3).join("\n"), dela: linhas.slice(1).filter((l) => nm.some((n) => l.toLowerCase().includes(n))) };
  }).filter((a) => a.dela.length);
}

async function rest(url, key, path, opts = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase: HTTP ${r.status} ${await r.text()}`);
  return opts.method === "PATCH" ? null : r.json();
}

async function conferirCeg({ nomeCeg, planilha, cobs, nomes }) {
  const abas = linhasDela(await baixarPlanilha(planilha), nomes);
  const abertas = cobs.filter((c) => ABERTAS.includes(c.data.status));
  if (!abas.length) return { resultados: abertas.map((c) => ({ id: c.id, resultado: "nao_encontrada", nota: "" })), faltando: [], semNome: true };
  const lista = cobs.map((c) => `- ${ABERTAS.includes(c.data.status) ? "ABERTA " : ""}id ${c.id}: ${c.data.referente || "(sem título)"} | ${c.data.tipo || ""} | ${brl(c.data.valor)} | status ${c.data.status} | prazo ${c.data.prazo || "—"}`).join("\n") || "(nenhuma)";
  const { json } = await gerarJson({
    system: SYSTEM,
    schema: SCHEMA,
    maxTokens: 4000,
    texto: `CEG: ${nomeCeg}\n\n${abas.map((a) => `Aba "${a.aba}" — cabeçalho:\n${a.cabecalho}\nLinhas dela:\n${a.dela.join("\n")}`).join("\n\n").slice(0, MAX_CHARS)}\n\nCobranças anotadas:\n${lista}`,
  });
  return json;
}

// Linha da planilha que falta no app -> sugestão "cobrança nova" na caixa.
export function sugestoesDaPlanilha(lista) {
  return lista.map((f) => ({
    id: "pl-" + createHash("sha1").update(`${f.ceg}|${String(f.trecho || "").trim()}|${f.valor ?? ""}`).digest("hex").slice(0, 16),
    registro: { destino: "cobrancas", acao: "nova", referente: f.referente, tipo: f.tipo, valor: f.valor, prazo: f.prazo, comunidade: f.comunidade, ceg: f.ceg, trecho: f.trecho, confianca: typeof f.valor === "number" ? "alta" : "media", duvidas: "veio da planilha da GOM; confira se não é repetida", estado: "pendente" },
  }));
}

export async function conferirCobrancas(url, key, ownerId, { nomes, hoje = hojeBR() } = {}) {
  if (!ownerId) throw new Error("Falta OWNER_ID (uuid da sua conta no Supabase).");
  if (!nomes?.length) throw new Error("Falta MEUS_NOMES.");
  if (!process.env.GEMINI_API_KEY) throw new Error("Falta GEMINI_API_KEY.");
  const docs = await rest(url, key, `docs?owner=eq.${ownerId}&col=in.(cobrancas,cegs,caixa)&select=col,id,data&limit=10000`);
  const cegDocs = docs.filter((d) => d.col === "cegs" && d.data.planilha);
  const planilhas = new Map(cegDocs.map((d) => [d.data.nome, d.data.planilha]));
  const comunidadeDa = new Map(cegDocs.map((d) => [d.data.nome, d.data.comunidade || ""]));
  const todas = docs.filter((d) => d.col === "cobrancas");
  const abertas = todas.filter((d) => ABERTAS.includes(d.data.status));

  // Toda CEG com planilha que ainda não acabou entra (não só as que têm
  // cobrança aberta): é assim que aparece a cobrança que falta no app.
  const porCeg = new Map();
  for (const d of cegDocs) if (!/conclu|recebid|finaliz/i.test(d.data.status || "")) porCeg.set(d.data.nome, []);
  for (const c of abertas) { const k = c.data.ceg || ""; if (!porCeg.has(k)) porCeg.set(k, []); }
  for (const c of todas) { const k = c.data.ceg || ""; if (porCeg.has(k)) porCeg.get(k).push(c); }

  const resumo = { abertas: abertas.length, conferidas: 0, divergentes: 0, naoEncontradas: 0, semPlanilha: 0, faltando: 0, erros: [] };
  const patches = []; // {id, data}
  const sugestoes = []; // cobranças que estão na planilha e faltam no app

  const tarefas = [...porCeg].map(([nomeCeg, cobs]) => async () => {
    const nAbertas = cobs.filter((c) => ABERTAS.includes(c.data.status)).length;
    const planilha = planilhas.get(nomeCeg);
    if (!planilha) { resumo.semPlanilha += nAbertas; return; }
    // O paboracha não é planilha: tem conferência própria (conferir-paboracha.mjs).
    if (/paboracha\.com/i.test(planilha)) { resumo.paboracha = (resumo.paboracha || 0) + nAbertas; return; }
    try {
      const { resultados, faltando = [] } = await conferirCeg({ nomeCeg, planilha, cobs, nomes });
      for (const res of resultados) {
        const c = cobs.find((x) => x.id === res.id);
        if (!c || !ABERTAS.includes(c.data.status)) continue;
        if (res.resultado === "igual") {
          resumo.conferidas++;
          patches.push({ id: c.id, muda: () => ({ conferidoEm: hoje }) });
        } else if (res.resultado === "diferente") {
          resumo.divergentes++;
          patches.push({ id: c.id, muda: (atual) => {
            const semAuto = String(atual.obs || "").split("\n").filter((l) => !l.startsWith("[auto ")).join("\n");
            const obs = (semAuto ? semAuto + "\n" : "") + `[auto ${ddmm(hoje)}] planilha diverge: ${res.nota}`;
            return { obs, ...(atual.status === "Pendente" ? { status: "A confirmar" } : {}) };
          } });
        } else resumo.naoEncontradas++;
      }
      for (const f of faltando) sugestoes.push({ ceg: nomeCeg, comunidade: comunidadeDa.get(nomeCeg) || "", ...f });
    } catch (e) {
      resumo.erros.push(`${nomeCeg}: ${e.message}`);
    }
  });
  // Poucas por vez, pra não estourar a cota grátis da IA.
  for (let i = 0; i < tarefas.length; i += 4) await Promise.all(tarefas.slice(i, i + 4).map((f) => f()));

  // Sugestões com id fixo: a mesma linha não volta depois de aceita ou descartada.
  const jaNaCaixa = new Set(docs.filter((d) => d.col === "caixa").map((d) => d.id));
  const novas = sugestoesDaPlanilha(sugestoes).filter((x) => !jaNaCaixa.has(x.id));
  resumo.faltando = novas.length;
  if (novas.length) {
    const agora = new Date().toISOString();
    await rest(url, key, "docs?on_conflict=owner,col,id", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(novas.map((x) => ({ owner: ownerId, col: "caixa", id: x.id, data: { origem: "planilha", recebidoEm: agora, estado: "lida", resumo: `Na planilha e não no app: ${x.registro.referente}`, ceg: { nome: x.registro.ceg }, registros: [x.registro] } }))),
    });
  }

  // Relê cada cobrança logo antes de gravar e só mexe nos campos da conferência,
  // pra não apagar uma edição que a usuária tenha feito enquanto a IA lia as
  // planilhas. Se ela marcou como paga nesse meio tempo, não mexe.
  for (const p of patches) {
    const filtro = `docs?owner=eq.${ownerId}&col=eq.cobrancas&id=eq.${encodeURIComponent(p.id)}`;
    const [atual] = await rest(url, key, `${filtro}&select=data`);
    if (!atual || !ABERTAS.includes(atual.data.status)) continue;
    await rest(url, key, filtro, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...atual.data, ...p.muda(atual.data) } }),
    });
  }
  return resumo;
}

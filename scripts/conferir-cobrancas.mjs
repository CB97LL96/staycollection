// Confere todo dia as cobranças em aberto com a planilha de cada CEG.
//
// Fluxo: lê as cobranças e as CEGs da usuária no Supabase (tabela docs),
// baixa a planilha de cada CEG (campo "planilha" da CEG), separa as linhas que
// citam o nome dela e pede pro Claude comparar com as cobranças em aberto.
//
// O que grava (só em cobranças em aberto, e só estes campos):
//   - bate com a planilha  -> conferidoEm = hoje (o app mostra "conferido hoje")
//   - não bate             -> status vira "A confirmar" (se estava "Pendente")
//                             e uma linha "[auto dd/mm] ..." entra em obs
//   - não achou o nome     -> não mexe em nada (só conta no resultado)
// Nunca muda valor, prazo nem marca como "Paga" sozinho.
//
// Roda dentro do cron diário (api/cron/sync-catalogo.js). Variáveis de ambiente:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, MEUS_NOMES
//   OWNER_ID  uuid da sua conta: Supabase > Authentication > Users > User UID
import Anthropic from "@anthropic-ai/sdk";

const ABERTAS = ["Pendente", "A confirmar", "Aguardando a GOM", "Não liberado"];
const MAX_CHARS = 120000;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resultados"],
  properties: {
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
Não invente. Na dúvida, use "nao_encontrada".`;

const brl = (n) => (typeof n === "number" ? `R$ ${n.toFixed(2).replace(".", ",")}` : "valor não informado");
const ddmm = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

// Link de planilha do Google -> CSV. Aceita o gid do link (aba específica).
export function urlCsv(link) {
  const m = String(link || "").match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (!m) return null;
  const gid = (String(link).match(/[#&?]gid=(\d+)/) || [])[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

async function baixarPlanilha(link) {
  const csv = urlCsv(link);
  const r = await fetch(csv || link, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`planilha: HTTP ${r.status} (a planilha precisa estar aberta por link)`);
  let t = await r.text();
  if (!csv) t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ");
  if (/<html/i.test(t.slice(0, 500)) && csv) throw new Error("planilha pediu login (não está aberta por link)");
  return t;
}

// Cabeçalho + só as linhas que citam algum dos nomes dela.
export function linhasDela(texto, nomes) {
  const linhas = texto.split(/\r?\n/);
  const nm = nomes.map((n) => n.toLowerCase()).filter(Boolean);
  const dela = linhas.slice(1).filter((l) => nm.some((n) => l.toLowerCase().includes(n)));
  return { cabecalho: linhas.slice(0, 3).join("\n"), dela };
}

async function rest(url, key, path, opts = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase: HTTP ${r.status} ${await r.text()}`);
  return opts.method === "PATCH" ? null : r.json();
}

async function conferirCeg(client, { nomeCeg, planilha, cobs, nomes }) {
  const texto = (await baixarPlanilha(planilha)).slice(0, MAX_CHARS * 4);
  const { cabecalho, dela } = linhasDela(texto, nomes);
  if (!dela.length) return { resultados: cobs.map((c) => ({ id: c.id, resultado: "nao_encontrada", nota: "" })), semNome: true };
  const lista = cobs.map((c) => `- id ${c.id}: ${c.data.referente || "(sem título)"} | ${c.data.tipo || ""} | ${brl(c.data.valor)} | status ${c.data.status} | prazo ${c.data.prazo || "—"}`).join("\n");
  const r = await client.beta.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 4000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `CEG: ${nomeCeg}\n\nCabeçalho da planilha:\n${cabecalho}\n\nLinhas dela:\n${dela.join("\n").slice(0, MAX_CHARS)}\n\nCobranças anotadas:\n${lista}`,
    }],
  });
  const json = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(json);
}

export async function conferirCobrancas(url, key, ownerId, { nomes, hoje = hojeBR() } = {}) {
  if (!ownerId) throw new Error("Falta OWNER_ID (uuid da sua conta no Supabase).");
  if (!nomes?.length) throw new Error("Falta MEUS_NOMES.");
  const client = new Anthropic();
  const docs = await rest(url, key, `docs?owner=eq.${ownerId}&col=in.(cobrancas,cegs)&select=col,id,data&limit=5000`);
  const planilhas = new Map(docs.filter((d) => d.col === "cegs" && d.data.planilha).map((d) => [d.data.nome, d.data.planilha]));
  const abertas = docs.filter((d) => d.col === "cobrancas" && ABERTAS.includes(d.data.status));

  const porCeg = new Map();
  for (const c of abertas) {
    const k = c.data.ceg || "";
    if (!porCeg.has(k)) porCeg.set(k, []);
    porCeg.get(k).push(c);
  }

  const resumo = { abertas: abertas.length, conferidas: 0, divergentes: 0, naoEncontradas: 0, semPlanilha: 0, erros: [] };
  const patches = []; // {id, data}

  await Promise.all([...porCeg].map(async ([nomeCeg, cobs]) => {
    const planilha = planilhas.get(nomeCeg);
    if (!planilha) { resumo.semPlanilha += cobs.length; return; }
    try {
      const { resultados } = await conferirCeg(client, { nomeCeg, planilha, cobs, nomes });
      for (const res of resultados) {
        const c = cobs.find((x) => x.id === res.id);
        if (!c) continue;
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
    } catch (e) {
      resumo.erros.push(`${nomeCeg}: ${e.message}`);
    }
  }));

  // Relê cada cobrança logo antes de gravar e só mexe nos campos da conferência,
  // pra não apagar uma edição que a usuária tenha feito enquanto o Claude lia as
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

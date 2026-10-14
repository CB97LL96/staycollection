// Lê uma mensagem ou print (WhatsApp, planilha, site da GOM) e sugere
// registros pro app: cobranças, itens, envios e repasses.
// Roda no Vercel. Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   ANTHROPIC_API_KEY  chave da API do Claude
//   SUPABASE_URL, SUPABASE_ANON_KEY  os mesmos do config.js
//   ALLOWED_EMAILS  e-mails que podem usar, separados por vírgula
//   MEUS_NOMES  como você aparece nas planilhas e grupos, separados por vírgula
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const texto = { type: "string" };
const REGISTRO = {
  type: "object",
  additionalProperties: false,
  required: ["destino", "referente", "comunidade", "ceg", "tipo", "membro", "valor", "prazo", "status",
    "pix", "pagarComo", "pagarLink", "compOnde", "compLink", "obs", "confianca", "trecho", "duvidas"],
  properties: {
    destino: { type: "string", enum: ["cobrancas", "itens", "envios", "repasses"] },
    referente: { ...texto, description: "do que se trata, curto (ex.: frete internacional mercari 3.0)" },
    comunidade: texto,
    ceg: texto,
    tipo: { ...texto, description: "cobranças: Item, Frete internacional, Frete nacional, Taxa RF, Armazenamento, Multa ou Outro" },
    membro: { ...texto, description: "membro do Stray Kids, quando for item" },
    valor: { type: ["number", "null"], description: "em reais; null se não estiver escrito" },
    prazo: { ...texto, description: "AAAA-MM-DD, ou vazio" },
    status: { ...texto, description: "cobranças: Pendente, A confirmar, Aguardando a GOM, Não liberado, Paga ou Cancelada" },
    pix: texto,
    pagarComo: { ...texto, description: "onde/como pagar, curto" },
    pagarLink: texto,
    compOnde: { ...texto, description: "onde mandar o comprovante, curto" },
    compLink: texto,
    obs: texto,
    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
    trecho: { ...texto, description: "o trecho exato da fonte que sustenta o registro" },
    duvidas: { ...texto, description: "o que não ficou claro e precisa ser conferido; vazio se nada" },
  },
};
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resumo", "registros"],
  properties: {
    resumo: { ...texto, description: "uma ou duas frases sobre o que a fonte diz pra ela" },
    registros: { type: "array", items: REGISTRO },
  },
};

const SYSTEM = `Você ajuda uma colecionadora de Stray Kids no Brasil a manter em dia a gestão das compras coletivas (CEGs) de que ela participa. Cada CEG é organizada por uma GOM dentro de uma comunidade, e as cobranças (item, frete internacional, frete nacional, taxa RF, armazenamento, multa) chegam por mensagens de WhatsApp, prints de planilhas e sites das GOMs.

Você recebe uma fonte (texto colado, conversa exportada ou imagem) e devolve os registros que dizem respeito a ela, pra ela conferir antes de salvar no app.

- Ela aparece nas fontes com os nomes listados em "Meus nomes". Linhas, marcações e cobranças de outras pessoas não interessam.
- Um aviso geral pra todos da CEG (ex.: "frete liberado, prazo sexta") vale pra ela se ela participa daquela CEG. Nesse caso use confiança "media" e diga em "duvidas" que é um aviso geral.
- Não invente. Campo que a fonte não traz fica vazio (ou valor null). Valor em outra moeda vai em "obs", com valor null.
- Datas relativas ("amanhã", "sexta") viram data absoluta a partir de "Hoje".
- Use os nomes de comunidades e CEGs da lista de contexto quando a fonte claramente se referir a eles; senão escreva como está na fonte.
- "trecho" é a citação literal que sustenta o registro.
- Se nada na fonte for dela, devolva "registros" vazio e explique no resumo.`;

async function permitido(req){
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !process.env.SUPABASE_URL) return false;
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return false;
  const u = await r.json();
  const emails = (process.env.ALLOWED_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return emails.includes((u.email || "").toLowerCase());
}

const IMAGENS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default async function handler(req, res){
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!await permitido(req)) return res.status(401).json({ erro: "Entre com a sua conta pra usar a leitura." });

  const { fonte = "", imagem = null, contexto = {} } = req.body || {};
  if (!fonte.trim() && !imagem) return res.status(400).json({ erro: "Mande um texto ou uma imagem." });
  if (imagem && !IMAGENS.includes(imagem.tipo)) return res.status(400).json({ erro: "Formato de imagem não suportado." });

  const content = [];
  if (imagem) content.push({ type: "image", source: { type: "base64", media_type: imagem.tipo, data: imagem.dados } });
  content.push({
    type: "text",
    text: [
      `Hoje: ${contexto.hoje || new Date().toISOString().slice(0, 10)}`,
      `Meus nomes: ${process.env.MEUS_NOMES || "(não configurado)"}`,
      `Comunidades conhecidas: ${(contexto.comunidades || []).join("; ") || "(nenhuma)"}`,
      `CEGs conhecidas: ${(contexto.cegs || []).join("; ") || "(nenhuma)"}`,
      "",
      fonte.trim() ? `<fonte>\n${fonte}\n</fonte>` : "A fonte é a imagem acima.",
    ].join("\n"),
  });

  try {
    const r = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (r.stop_reason === "refusal") return res.status(422).json({ erro: "O Claude não quis ler essa fonte." });
    if (r.stop_reason === "max_tokens") return res.status(422).json({ erro: "A fonte é grande demais pra uma leitura só. Tente um trecho menor." });
    const json = r.content.filter(b => b.type === "text").map(b => b.text).join("");
    return res.status(200).json({ ...JSON.parse(json), modelo: r.model, uso: r.usage });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ erro: "Muitas leituras seguidas. Espere um pouco e tente de novo." });
    if (e instanceof Anthropic.AuthenticationError) return res.status(500).json({ erro: "A chave da API do Claude no Vercel está errada ou faltando." });
    if (e instanceof Anthropic.BadRequestError) return res.status(400).json({ erro: "A API recusou o pedido: " + e.message });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ erro: `A API do Claude falhou (${e.status}). Tente de novo.` });
    console.error(e);
    return res.status(500).json({ erro: "Erro inesperado na leitura." });
  }
}

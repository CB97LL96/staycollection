// Leitura de uma fonte (mensagem, conversa exportada ou print) pelo Claude:
// devolve sugestões de cobranças, itens, envios e repasses, pra ela conferir
// antes de salvar. Usado pelo api/ler.js (página de teste) e pelo
// api/telegram.js (caixa de entrada do Telegram).
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
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resumo", "registros"],
  properties: {
    resumo: { ...texto, description: "uma ou duas frases sobre o que a fonte diz pra ela" },
    registros: { type: "array", items: REGISTRO },
  },
};

export const SYSTEM = `Você ajuda uma colecionadora de Stray Kids no Brasil a manter em dia a gestão das compras coletivas (CEGs) de que ela participa. Cada CEG é organizada por uma GOM dentro de uma comunidade, e as cobranças (item, frete internacional, frete nacional, taxa RF, armazenamento, multa) chegam por mensagens de WhatsApp, prints de planilhas e sites das GOMs.

Você recebe uma fonte (texto colado, conversa exportada ou imagem) e devolve os registros que dizem respeito a ela, pra ela conferir antes de salvar no app.

- Ela aparece nas fontes com os nomes listados em "Meus nomes". Linhas, marcações e cobranças de outras pessoas não interessam.
- Um aviso geral pra todos da CEG (ex.: "frete liberado, prazo sexta") vale pra ela se ela participa daquela CEG. Nesse caso use confiança "media" e diga em "duvidas" que é um aviso geral.
- Não invente. Campo que a fonte não traz fica vazio (ou valor null). Valor em outra moeda vai em "obs", com valor null.
- Datas relativas ("amanhã", "sexta") viram data absoluta a partir de "Hoje".
- Use os nomes de comunidades e CEGs da lista de contexto quando a fonte claramente se referir a eles; senão escreva como está na fonte.
- "trecho" é a citação literal que sustenta o registro.
- Se nada na fonte for dela, devolva "registros" vazio e explique no resumo.`;

export const IMAGENS = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// imagens: [{ tipo, dados (base64) }]. Lança Anthropic.APIError nos erros da API
// e Error com .codigo ("recusa" | "grande_demais") nos outros.
export async function lerFonte({ fonte = "", imagens = [], contexto = {} }) {
  const content = [];
  for (const im of imagens) content.push({ type: "image", source: { type: "base64", media_type: im.tipo, data: im.dados } });
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
  const r = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (r.stop_reason === "refusal") throw Object.assign(new Error("O Claude não quis ler essa fonte."), { codigo: "recusa" });
  if (r.stop_reason === "max_tokens") throw Object.assign(new Error("A fonte é grande demais pra uma leitura só."), { codigo: "grande_demais" });
  const json = r.content.filter(b => b.type === "text").map(b => b.text).join("");
  return { ...JSON.parse(json), modelo: r.model, uso: r.usage };
}

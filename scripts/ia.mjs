// Chamada à IA num lugar só: manda um texto (e imagens, se houver) pro Gemini
// e devolve o JSON no formato do schema. Usado pela leitura (ler-core.mjs) e
// pela conferência das planilhas (conferir-cobrancas.mjs).
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   GEMINI_API_KEY  chave criada no Google AI Studio (aistudio.google.com)
//   GEMINI_MODEL    opcional; padrão gemini-3.8-flash (tem cota grátis)
//
// Erros com .codigo, pra quem chama decidir a mensagem:
//   "sem_chave"     falta GEMINI_API_KEY
//   "recusa"        o Gemini bloqueou o pedido ou a resposta
//   "grande_demais" a resposta passou do limite de tamanho
//   "limite"        cota grátis estourada (HTTP 429)
//   "chave_errada"  a chave foi recusada (HTTP 400/401/403 de autenticação)
import { GoogleGenAI, ApiError } from "@google/genai";

export const MODELO_PADRAO = "gemini-3.8-flash";
const RECUSA = ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"];

let cliente = null;
function client() {
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error("Falta GEMINI_API_KEY na Vercel."), { codigo: "sem_chave" });
  if (!cliente) cliente = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return cliente;
}

const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });

// imagens: [{ tipo, dados (base64) }]
export async function gerarJson({ system, texto, imagens = [], schema, maxTokens = 16000 }) {
  const parts = imagens.map((im) => ({ inlineData: { mimeType: im.tipo, data: im.dados } }));
  parts.push({ text: texto });
  let r;
  try {
    r = await client().models.generateContent({
      model: process.env.GEMINI_MODEL || MODELO_PADRAO,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        maxOutputTokens: maxTokens,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 429) throw erro("A cota grátis do Gemini acabou por agora. Tente de novo mais tarde.", "limite");
      if (e.status === 401 || e.status === 403 || (e.status === 400 && /api key/i.test(e.message))) throw erro("A chave do Gemini na Vercel está errada.", "chave_errada");
    }
    throw e;
  }
  if (r.promptFeedback && r.promptFeedback.blockReason) throw erro("O Gemini não quis ler essa fonte.", "recusa");
  const fim = r.candidates && r.candidates[0] && r.candidates[0].finishReason;
  if (RECUSA.includes(fim)) throw erro("O Gemini não quis ler essa fonte.", "recusa");
  if (fim === "MAX_TOKENS") throw erro("A fonte é grande demais pra uma leitura só.", "grande_demais");
  const txt = r.text || "";
  if (!txt.trim()) throw erro("O Gemini devolveu uma resposta vazia.", "recusa");
  return { json: JSON.parse(txt), modelo: r.modelVersion || process.env.GEMINI_MODEL || MODELO_PADRAO, uso: r.usageMetadata };
}

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
// Reservas quando o principal está lotado (também na cota grátis). A família
// 2.5 não está mais disponível para contas novas (404).
export const MODELOS_RESERVA = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
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
  // Tenta o modelo principal e, se ele estiver lotado (503/500), fora do ar ou
  // demorar, os modelos reserva. Cada um tem 35 s, pra caber nos 120 s da função.
  const modelos = [...new Set([process.env.GEMINI_MODEL || MODELO_PADRAO, ...MODELOS_RESERVA])];
  const falhas = [];
  for (const model of modelos) {
    let r;
    try {
      r = await client().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          maxOutputTokens: maxTokens,
          // Raciocínio curto: extrair cobranças não precisa de mais. A família
          // 2.5 usa orçamento em tokens; a 3 usa nível.
          thinkingConfig: /^gemini-2\./.test(model) ? { thinkingBudget: 1024 } : { thinkingLevel: "LOW" },
          // No máximo 2 tentativas por modelo (o padrão do SDK são 5, com
          // esperas de até 60 s, e a função morria no meio).
          httpOptions: { timeout: 33000, retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 3 } },
          abortSignal: AbortSignal.timeout(35000),
        },
      });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 429) throw erro(`A cota grátis do Gemini recusou o pedido (429): ${String(e.message).slice(0, 300)}`, "limite");
        // A mensagem do Google vai junto (sem a chave), pra saber se é chave
        // inválida, termos não aceitos no AI Studio ou modelo indisponível.
        if (e.status === 401 || e.status === 403 || (e.status === 400 && /api key/i.test(e.message))) throw erro(`A chave do Gemini foi recusada (${e.status}): ${String(e.message).slice(0, 300)}`, "chave_errada");
      }
      const passageiro = (e instanceof ApiError && [500, 502, 503, 504, 404].includes(e.status))
        || (e && (e.name === "AbortError" || e.name === "TimeoutError" || /abort|timed? ?out|fetch failed/i.test(String(e.message))));
      if (!passageiro) throw e;
      falhas.push(`${model}: ${e.status || e.name || "erro"}`);
      continue;
    }
    if (r.promptFeedback && r.promptFeedback.blockReason) throw erro("O Gemini não quis ler essa fonte.", "recusa");
    const fim = r.candidates && r.candidates[0] && r.candidates[0].finishReason;
    if (RECUSA.includes(fim)) throw erro("O Gemini não quis ler essa fonte.", "recusa");
    const txt = r.text || "";
    // Resposta cortada ou vazia: tenta o próximo modelo antes de desistir.
    let json = null;
    try { json = JSON.parse(txt); } catch (e) { json = null; }
    if (json && typeof json === "object") return { json, modelo: r.modelVersion || model, uso: r.usageMetadata };
    falhas.push(`${model}: resposta ${txt.trim() ? "incompleta" : "vazia"} (fim ${fim || "?"}, ${txt.length} caracteres)`);
    if (fim === "MAX_TOKENS" && model === modelos[modelos.length - 1]) throw erro("A fonte é grande demais pra uma leitura só.", "grande_demais");
  }
  throw erro(`O Gemini não conseguiu responder agora (${falhas.join("; ")}). Tente de novo daqui a pouco.`, "limite");
}

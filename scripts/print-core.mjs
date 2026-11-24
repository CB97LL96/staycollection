// Colar print: a IA acha cada card (photocard ou merch) num print de tabela,
// flyer ou board, e devolve a posição dele pra o navegador recortar.
// Usado por api/print.js.
import { gerarJson } from "./ia.mjs";

const texto = { type: "string" };
export const SCHEMA = {
  type: "object", additionalProperties: false, required: ["resumo", "cards"],
  properties: {
    resumo: { ...texto, description: "uma frase: o que é o print" },
    cards: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["caixa", "tipo", "membro", "nome", "numero", "legivel"],
        properties: {
          caixa: { type: "array", items: { type: "integer" }, description: "[ymin, xmin, ymax, xmax] de 0 a 1000, só o card (a imagem do photocard ou do item), sem o texto em volta" },
          tipo: { type: "string", enum: ["photocard", "merch", "outro"] },
          membro: { ...texto, description: "Bang Chan, Lee Know, Changbin, Hyunjin, HAN, Felix, Seungmin ou I.N; vazio se não der pra saber (não chute pelo rosto: só se estiver escrito)" },
          nome: { ...texto, description: "texto escrito perto do card: versão, loja, set, apelido. Vazio se não houver" },
          numero: { ...texto, description: "número ou etiqueta colada no card (ex.: 26, 10 cada); vazio se não houver" },
          legivel: { type: "boolean", description: "false se o card está borrado ou cortado demais" },
        },
      },
    },
  },
};

const SYSTEM = `Você olha um print de uma colecionadora de Stray Kids no Brasil: pode ser a tabela de uma CEG, o flyer de uma GOM ou um board de fotos. Ache CADA card (photocard ou item de merch) que aparece como imagem e devolva a caixa dele.
- A caixa cobre só a imagem do card, na ordem de leitura (de cima pra baixo, da esquerda pra direita).
- Não invente card que não aparece. Não junte dois cards numa caixa.
- Membro só se estiver escrito no print (legenda, tabela, etiqueta). Não reconheça pelo rosto.
- Use os termos das comunidades: POB, LD, set, ver., pc.`;

export const clamp = (n) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));

// Descarta caixa inválida ou minúscula, corrige ordem e limites.
export function normalizar(json) {
  const cards = [];
  for (const c of (json && json.cards) || []) {
    const b = Array.isArray(c.caixa) ? c.caixa.map(clamp) : [];
    if (b.length !== 4) continue;
    const caixa = [Math.min(b[0], b[2]), Math.min(b[1], b[3]), Math.max(b[0], b[2]), Math.max(b[1], b[3])];
    if (caixa[2] - caixa[0] < 25 || caixa[3] - caixa[1] < 25) continue;
    cards.push({ ...c, caixa, membro: String(c.membro || ""), nome: String(c.nome || "").slice(0, 120), numero: String(c.numero || "").slice(0, 20) });
  }
  return { resumo: (json && json.resumo) || "", cards: cards.slice(0, 80) };
}

export async function lerPrint({ imagem }) {
  const { json, modelo } = await gerarJson({ system: SYSTEM, schema: SCHEMA, imagens: [imagem], texto: "Ache os cards deste print.", maxTokens: 8000 });
  return { ...normalizar(json), modelo };
}

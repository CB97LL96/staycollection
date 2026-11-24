// O bot que investiga (etapa 1 do staycollection 2).
//
// Antes: a IA lia a mensagem sozinha e devolvia sugestões soltas.
// Agora, para cada mensagem:
//   1. acha a CEG por código (nome do grupo no .txt, nome da CEG, do grupo,
//      da GOM e da comunidade citados no texto);
//   2. monta o dossiê de cada CEG candidata: cobranças (com id), claims e
//      itens, notas e as linhas da planilha com o nome dela;
//   3. a IA compara a mensagem com o dossiê e devolve só o que muda
//      (cobrança nova, já paga, valor ou prazo novo, status de item);
//   4. o total devido na CEG é calculado aqui, por código, nunca pela IA.
//
// As sugestões saem no formato da caixa do app atual (acao + alvo), então o
// app de hoje já mostra e aceita. Nada é gravado sem ela aceitar.
// Sem pix: o bot nunca extrai chave pix nem caminho de comprovante.
import { mapear, norm } from "./v2/mapear.mjs";
import { gerarJson } from "./ia.mjs";
import { baixarPlanilha, linhasDela } from "./conferir-cobrancas.mjs";

const ABERTAS = ["Pendente", "A confirmar", "Aguardando a GOM", "Não liberado"];
const FINAIS_CEG = /conclu|recebid|finaliz/i;
const MAX_PLANILHA = 30000;
export const brl = (n) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

// "Conversa do WhatsApp com CEG Caixa 2.txt" -> "CEG Caixa 2"
export const grupoDoArquivo = (nome) => (String(nome || "").match(/conversa do whatsapp com (.+?)(?:\.txt)?$/i) || [])[1] || "";
const contem = (texto, termo) => { const t = norm(termo); return t.length >= 4 && texto.includes(t); };

// Pontua cada CEG pela mensagem. Devolve as candidatas, melhor primeiro.
export function acharCeg({ texto = "", nomeArquivo = "" }, t) {
  const msg = norm(texto), grupo = norm(grupoDoArquivo(nomeArquivo));
  const com = new Map(t.comunidades.map((c) => [c.id, c])), gom = new Map(t.goms.map((g) => [g.id, g]));
  const out = [];
  for (const c of t.cegs) {
    let pontos = 0; const porque = [];
    const nomes = [c.nome, c.grupo_wa].filter(Boolean);
    if (grupo && nomes.some((n) => norm(n) === grupo)) { pontos += 100; porque.push("grupo do .txt"); }
    else if (grupo && nomes.some((n) => norm(n).length >= 4 && (grupo.includes(norm(n)) || norm(n).includes(grupo)))) { pontos += 60; porque.push("grupo do .txt parecido"); }
    if (nomes.some((n) => contem(msg, n))) { pontos += 40; porque.push("nome citado"); }
    const cm = com.get(c.comunidade_id);
    if (cm && [cm.nome, cm.apelido].some((n) => n && contem(msg, n))) { pontos += 10; porque.push("comunidade citada"); }
    const g = gom.get(c.gom_id);
    if (g && contem(msg, g.nome)) { pontos += 10; porque.push("GOM citada"); }
    if (!pontos) continue;
    if (FINAIS_CEG.test(c.status || "")) pontos -= 15;
    out.push({ ceg: c, pontos, porque });
  }
  return out.sort((a, b) => b.pontos - a.pontos);
}

// Dossiê de uma CEG: o que já existe no app sobre ela.
export function dossie(c, t) {
  const com = t.comunidades.find((x) => x.id === c.comunidade_id);
  const gom = t.goms.find((x) => x.id === c.gom_id);
  const cobs = t.cobrancas.filter((x) => x.ceg_id === c.id && x.direcao === "pagar");
  const claims = t.claims.filter((x) => x.ceg_id === c.id).map((cl) => ({ ...cl, itens: t.itens.filter((i) => i.claim_id === cl.id) }));
  return { ceg: c, comunidade: com || null, gom: gom || null, cobs, claims };
}

// id do registro no app atual (tabela docs): é o que o app usa pra aceitar
const idAntigo = (id) => String(id).replace(/^(cob|claim)-/, "");

function dossieTexto(d, planilha) {
  const linhas = [
    `CEG "${d.ceg.nome}"${d.comunidade ? ` · comunidade ${d.comunidade.apelido || d.comunidade.nome}` : ""}${d.gom ? ` · GOM ${d.gom.nome}` : ""}${d.ceg.status ? ` · status ${d.ceg.status}` : ""}`,
    d.ceg.notas || d.comunidade?.notas ? `Notas dela: ${[d.ceg.notas, d.comunidade?.notas].filter(Boolean).join(" / ")}` : "",
    "Cobranças já anotadas:",
    ...(d.cobs.length ? d.cobs.map((c) => `- [cobranca ${idAntigo(c.id)}] ${c.referente || "(sem título)"} | ${c.tipo || ""} | ${typeof c.valor === "number" ? brl(c.valor) : "sem valor"} | ${c.status || ""}${c.prazo ? ` | prazo ${c.prazo}` : ""}${c.pago_em ? ` | paga em ${c.pago_em}` : ""}`) : ["(nenhuma)"]),
    "Claims e itens dela:",
    ...(d.claims.length ? d.claims.map((cl) => `- [item ${idAntigo(cl.id)}] claim "${cl.texto}"${typeof cl.valor === "number" ? ` ${brl(cl.valor)}` : ""} | ${(cl.itens[0] && cl.itens[0].status) || ""}${cl.itens.length > 1 || cl.itens.some((i) => i.card_id) ? ` | cards: ${cl.itens.map((i) => i.card_id || i.descricao).filter(Boolean).join(", ")}` : ""}${cl.notas ? ` | nota dela: ${cl.notas}` : ""}${(cl.legado && cl.legado.travado && cl.legado.travado.length) ? ` | ela travou: ${cl.legado.travado.join(", ")}` : ""}`) : ["(nenhuma)"]),
  ];
  if (planilha) linhas.push(planilha);
  return linhas.filter(Boolean).join("\n");
}

async function planilhaTexto(link, nomes) {
  try {
    const abas = linhasDela(await baixarPlanilha(link), nomes);
    if (!abas.length) return { texto: "Planilha: lida, mas o nome dela não aparece.", abas: [] };
    return { texto: `Planilha (só as linhas com o nome dela):\n${abas.map((a) => `Aba "${a.aba}":\n${a.cabecalho}\n${a.dela.join("\n")}`).join("\n\n")}`.slice(0, MAX_PLANILHA), abas: abas.map((a) => a.aba) };
  } catch (e) {
    return { texto: `Planilha: não consegui ler (${e.message}).`, abas: [], erro: e.message };
  }
}

const texto = { type: "string" };
const MUDANCA = {
  type: "object", additionalProperties: false,
  required: ["acao", "alvo", "destino", "referente", "tipo", "membro", "valor", "prazo", "status", "base", "trecho", "confianca", "duvidas"],
  properties: {
    acao: { type: "string", enum: ["nova", "paga", "valor", "prazo", "cancelada", "status"] },
    alvo: { ...texto, description: "o id entre colchetes do dossiê (cobranca ou item) quando a ação muda algo que já existe; vazio em 'nova'" },
    destino: { type: "string", enum: ["cobrancas", "itens", "envios", "repasses"] },
    referente: { ...texto, description: "do que se trata, curto, nos termos da comunidade (ex.: frete inter, taxa, POB Aladin Han)" },
    tipo: { ...texto, description: "cobranças: Item, Frete internacional, Frete nacional, Taxa RF, Armazenamento, Multa ou Outro" },
    membro: texto,
    valor: { type: ["number", "null"], description: "em reais; null se não estiver escrito" },
    prazo: { ...texto, description: "AAAA-MM-DD ou vazio" },
    status: { ...texto, description: "cobrança: Pendente, A confirmar, Aguardando a GOM, Não liberado. Item (acao status): Garantido, Comprado, Na seller, A caminho da proxy, Na WH / proxy, A caminho do Brasil, Com a GOM no Brasil, Envio liberado, Enviado, Recebido, Set não fechou, Claim perdida" },
    base: { type: "string", enum: ["mensagem", "planilha", "os dois"] },
    trecho: { ...texto, description: "citação literal da mensagem ou da linha da planilha" },
    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
    duvidas: texto,
  },
};
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["resumo", "ceg", "pergunta", "mudancas"],
  properties: {
    resumo: { ...texto, description: "uma ou duas frases, na língua da comunidade" },
    ceg: { ...texto, description: "o nome exato da CEG do dossiê de que a mensagem trata; vazio se não der pra saber" },
    pergunta: { ...texto, description: "se não der pra saber a CEG ou se é dela, a pergunta curta pra ela; senão vazio" },
    mudancas: { type: "array", items: MUDANCA },
  },
};

const SYSTEM = `Você ajuda uma colecionadora de Stray Kids no Brasil a manter em dia as CEGs (compras coletivas) de que ela participa. Cada CEG tem uma GOM, dentro de uma comunidade. Fale e escreva como as comunidades falam: CEG, GOM, claim, set, POB, LD, pc, cobrança, frete inter, frete nacional, taxa, envio liberado, recebido, repasse.

Você recebe uma mensagem (de grupo, da GOM, print ou conversa exportada) e o DOSSIÊ de uma ou mais CEGs: o que já está anotado no app e as linhas da planilha da GOM com o nome dela.

Sua tarefa é dizer só o que MUDA no app:
- "nova": cobrança, item, envio ou repasse que a mensagem ou a planilha mostra e que NÃO está no dossiê. Antes de criar, confira se não é a mesma de uma já anotada com outro nome (a GOM usa apelidos e números: "caixa 2", "26 e 27", "linguinha"). Se for a mesma, não crie.
- "paga": cobrança anotada que a planilha ou a GOM mostra como paga.
- "valor" ou "prazo": cobrança anotada com valor ou prazo diferente.
- "cancelada": cobrança que deixou de existir.
- "status": claim/item anotado que mudou de etapa (ex.: chegou no Brasil = "Com a GOM no Brasil"; envio liberado = "Envio liberado"). Uma mudança por item, com o id [item ...] dele em "alvo".
- O que já está igual NÃO entra.

Regras:
- Ela aparece com os nomes de "Meus nomes". Linhas e cobranças de outras pessoas não interessam.
- Aviso geral pra todos da CEG ("frete liberado, prazo sexta") vale pra ela se ela tem itens nessa CEG. Use confiança "media" e diga em "duvidas" que é aviso geral, a menos que a planilha confirme o valor dela (aí "alta").
- Valor só se estiver escrito (na mensagem ou na linha dela da planilha). Não calcule rateio por conta própria. Moeda estrangeira vai em "duvidas", com valor null.
- Datas relativas viram absolutas a partir de "Hoje".
- Item com "ela travou": ela editou esse campo à mão. Só proponha mudança nele se a mensagem for clara, e então use confiança "media" e diga em "duvidas" que o campo estava travado.
- "nota dela" é informação que ela mesma escreveu sobre o item: use como contexto.
- Nunca extraia chave pix nem onde mandar comprovante.
- Se a mensagem não for sobre nenhuma CEG do dossiê, ou não der pra saber qual, deixe "ceg" vazio e pergunte em "pergunta".
- "trecho" é sempre citação literal. Não invente.`;

// fonte: { texto, nomeArquivo, imagens }, docs: registros do app (tabela docs)
export async function investigar({ texto: msg = "", nomeArquivo = "", imagens = [] }, docs, { nomes = [], hoje, cegForcada = null, maxCegs = 3 } = {}) {
  const { tabelas: t } = mapear(docs);
  let cands = cegForcada ? [{ ceg: t.cegs.find((c) => c.id === cegForcada || c.nome === cegForcada), pontos: 999, porque: ["escolhida por ela"] }].filter((x) => x.ceg) : acharCeg({ texto: msg, nomeArquivo }, t);
  cands = cands.slice(0, maxCegs);

  // planilha citada na mensagem também entra
  const linkNaMsg = (msg.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+[^\s]*/) || [])[0];
  // planilha só das 2 melhores candidatas, pra caber no tempo do Telegram
  const dossies = await Promise.all(cands.map(async ({ ceg }, i) => {
    const d = dossie(ceg, t);
    const link = i < 2 && ceg.planilha && !/paboracha\.com/i.test(ceg.planilha) ? ceg.planilha : null;
    d.planilha = link ? await planilhaTexto(link, nomes) : null;
    return d;
  }));
  const extra = linkNaMsg && !dossies.some((d) => d.ceg.planilha === linkNaMsg) ? await planilhaTexto(linkNaMsg, nomes) : null;

  const contexto = [
    `Hoje: ${hoje}`,
    `Meus nomes: ${nomes.join(", ") || "(não configurado)"}`,
    dossies.length ? dossies.map((d, i) => `=== DOSSIÊ ${i + 1} ===\n${dossieTexto(d, d.planilha && d.planilha.texto)}`).join("\n\n") : `Nenhuma CEG reconhecida pela mensagem. CEGs que ela tem: ${t.cegs.map((c) => c.nome).join("; ")}`,
    extra ? `=== PLANILHA CITADA NA MENSAGEM ===\n${extra.texto}` : "",
    nomeArquivo ? `Arquivo: ${nomeArquivo}` : "",
    msg.trim() ? `<mensagem>\n${msg}\n</mensagem>` : "A mensagem é a imagem acima.",
  ].filter(Boolean).join("\n\n");

  const { json, modelo } = await gerarJson({ system: SYSTEM, schema: SCHEMA, imagens, texto: contexto, maxTokens: 8000 });
  const escolhida = dossies.find((d) => d.ceg.nome === json.ceg) || (dossies.length === 1 && json.ceg ? dossies[0] : null);
  return montar(json, escolhida, { cands, modelo, t });
}

// Converte a resposta da IA nos registros da caixa e calcula o total devido.
export function montar(json, d, { cands = [], modelo = "", t } = {}) {
  const cobIds = new Set((d ? d.cobs : []).map((c) => idAntigo(c.id)));
  const itemIds = new Set((d ? d.claims : []).map((cl) => idAntigo(cl.id)));
  const comNome = d && d.comunidade ? d.comunidade.nome : "";
  const registros = [];
  for (const m of json.mudancas || []) {
    const r = { destino: m.destino, acao: m.acao, referente: m.referente, comunidade: comNome, ceg: d ? d.ceg.nome : "", tipo: m.tipo, membro: m.membro, valor: m.valor, prazo: m.prazo, status: m.status, trecho: m.trecho, confianca: m.confianca, duvidas: [m.duvidas, m.base !== "mensagem" ? `fonte: ${m.base}` : ""].filter(Boolean).join(" · "), estado: "pendente" };
    if (m.acao !== "nova") {
      const alvo = String(m.alvo || "").trim();
      const ok = m.acao === "status" ? itemIds.has(alvo) : cobIds.has(alvo);
      if (!ok) continue; // alvo inventado ou de outra CEG: descarta
      r.alvo = alvo;
      if (m.acao === "status") r.destino = "itens";
      else r.destino = "cobrancas";
    }
    registros.push(r);
  }
  // total devido na CEG depois das mudanças (só o que é certo: status Pendente)
  let total = null, semValor = 0;
  if (d) {
    const cobs = new Map(d.cobs.filter((c) => c.direcao !== "receber").map((c) => [idAntigo(c.id), { ...c }]));
    for (const r of registros) {
      const c = r.alvo && cobs.get(r.alvo);
      if (c && r.acao === "paga") c.status = "Paga";
      if (c && r.acao === "cancelada") c.status = "Cancelada";
      if (c && r.acao === "valor") c.valor = r.valor;
      if (r.acao === "nova" && r.destino === "cobrancas" && r.confianca === "alta") cobs.set(`nova-${cobs.size}`, { status: "Pendente", valor: r.valor });
    }
    total = 0;
    for (const c of cobs.values()) if (c.status === "Pendente") { if (typeof c.valor === "number") total += c.valor; else semValor++; }
    total = Math.round(total * 100) / 100;
  }
  return {
    resumo: json.resumo, pergunta: json.pergunta || "", modelo,
    ceg: d ? { id: d.ceg.id, nome: d.ceg.nome, comunidade: comNome, gom: d.gom ? d.gom.nome : "", ondeOlhar: d.ceg.grupo_wa || comNome, planilha: d.planilha ? { abas: d.planilha.abas, erro: d.planilha.erro || "" } : null } : null,
    candidatas: cands.map((c) => ({ id: c.ceg.id, nome: c.ceg.nome })),
    registros, totalDevido: total, semValor,
  };
}

// Texto da resposta no Telegram (sem markdown, pra não quebrar com símbolos).
const ACAO_TXT = { nova: "novo", paga: "já paga", valor: "valor novo", prazo: "prazo novo", cancelada: "cancelada", status: "agora" };
export function respostaTelegram(r) {
  if (!r.ceg) return r.pergunta || `Li, mas não achei de qual CEG é: ${r.resumo}`;
  const l = [`CEG ${r.ceg.nome}${r.ceg.gom ? ` · GOM ${r.ceg.gom}` : ""}`];
  const itens = r.registros.filter((x) => x.acao === "status");
  for (const x of r.registros.filter((x) => x.acao !== "status")) {
    const v = typeof x.valor === "number" ? ` ${brl(x.valor)}` : "";
    const p = x.prazo ? ` (prazo ${x.prazo.slice(8, 10)}/${x.prazo.slice(5, 7)})` : "";
    l.push(`• ${ACAO_TXT[x.acao]}: ${x.referente}${v}${p}${x.confianca !== "alta" ? " [conferir]" : ""}`);
  }
  if (itens.length) {
    const porStatus = new Map(); itens.forEach((x) => porStatus.set(x.status, (porStatus.get(x.status) || 0) + 1));
    for (const [s, n] of porStatus) l.push(`• ${n} ${n === 1 ? "item" : "itens"} agora: ${s}`);
  }
  if (!r.registros.length) l.push("Nada novo: o app já está igual.");
  if (r.totalDevido != null) l.push("", `Você deve nesta CEG: ${brl(r.totalDevido)}${r.semValor ? ` (+ ${r.semValor} sem valor)` : ""}`);
  if (r.registros.some((x) => x.acao === "nova" && x.destino === "cobrancas" && x.confianca !== "alta")) l.push("Cobranças marcadas [conferir] ainda não entram no total.");
  l.push(`Onde olhar: ${r.ceg.ondeOlhar || "grupo da CEG"}`);
  if (r.ceg.planilha) l.push(r.ceg.planilha.erro ? `Planilha: não consegui ler (${r.ceg.planilha.erro})` : r.ceg.planilha.abas.length ? `Conferido na planilha: ${r.ceg.planilha.abas.join(", ")}` : "Planilha lida, mas seu nome não aparece nela.");
  if (r.pergunta) l.push("", r.pergunta);
  return l.join("\n");
}

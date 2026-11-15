// Filtra conversas exportadas do WhatsApp (.txt, "sem mídia") e deixa só o que
// pode ser cobrança, num arquivo pequeno pra ler de uma vez (sem gastar token
// com papo de grupo). Não usa internet nem API: roda no seu computador.
//
// Uso:
//   node scripts/filtrar-whatsapp.mjs "nome1,nome2" [pasta] [opções]
//   (pasta padrão: _whatsapp ; saída: <pasta>/_filtrado.md)
//
// Opções:
//   --desde AAAA-MM-DD   só mensagens a partir dessa data
//   --talvez "a,b"       nomes soltos no texto (palavra inteira, fora de @marcação)
//                        que talvez sejam você; entram como [A?]
//   --nao "x,y"          nomes de outras pessoas parecidos com o seu: a mensagem
//                        não conta como [A?] se só tiver esses
//   --mdy / --dmy        força a ordem da data (sem isso, descobre por arquivo)
//   --bot                também grava <pasta>/_bot/*.txt, um por conversa, só
//                        com o que entrou, com a data em dd/mm/aaaa (pro bot)
//
// Entra no resultado:
//   [A]  mensagem que cita um dos seus nomes ou que você mandou (e a de antes e depois)
//   [A?] nome do --talvez solto no texto
//   [B]  aviso geral com valor em R$, pix, prazo, frete, taxa, liberação etc.
// Funciona com o formato do Android em português ("12/10/2026 14:05 - Nome: texto"),
// em inglês ("9/23/26, 23:08 - Nome: texto", mês/dia) e do iPhone
// ("[12/10/2026 14:05:33] Nome: texto").
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
function opcao(nome, comValor = true) {
  const i = args.indexOf(nome);
  if (i < 0) return comValor ? "" : false;
  return comValor ? args.splice(i, 2)[1] : (args.splice(i, 1), true);
}
const lista = (s) => (s || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const desde = opcao("--desde");
const talvez = lista(opcao("--talvez"));
const nao = lista(opcao("--nao"));
const ordemForcada = opcao("--mdy", false) ? "mdy" : opcao("--dmy", false) ? "dmy" : "";
const paraBot = opcao("--bot", false);
const nomes = lista(args[0]);
const pasta = args[1] || "_whatsapp";
if (!nomes.length) { console.error('Faltou os seus nomes: node scripts/filtrar-whatsapp.mjs "nome1,nome2"'); process.exit(1); }

const CHAVES = /cobran[çc]a|frete|taxa|\bpix\b|pagamento|pagar|\bpag[oa]s?\b|prazo|multa|armazen|comprovante|liberad|fechou|fechamento|vencimento|r\$\s*\d|\d+[.,]\d{2}\s*(reais)?|\bpaypal\b|\bboleto\b|\bdevendo\b|atras/i;
const SISTEMA = /criptografia|end-to-end encrypted|mudou o [íi]cone|changed (the )?(group|this group)|entrou usando|joined using|joined from the community|saiu$|\bleft$|foi removido|\bremoved\b|adicionou|\badded\b|created group|apagou esta mensagem|mensagem apagada|this message was deleted|you deleted this message|^\s*<m[íi]dia oculta>\s*$|^\s*<media omitted>\s*$|imagem ocultada|figurinha omitida|sticker omitted|^null$/i;
const EDITADA = /\s*<(this message was edited|mensagem editada)>/gi;
const INVISIVEIS = /[‎‏⁨⁩‪-‮]/g;
const INICIO = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,]?\s+(\d{1,2}):(\d{2})(?::\d{2})?(?:\s?([ap])\.?m\.?)?\]?\s*(?:-\s*)?([^:]+?):\s([\s\S]*)$/i;
const INICIO_SIS = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,]?\s+(\d{1,2}):(\d{2})/;

// Mês/dia ou dia/mês: se algum primeiro número passa de 12, é dia/mês; se algum
// segundo passa de 12, é mês/dia. Sem pista: o export em inglês ("9/7/26, 13:57 - ",
// ano com 2 dígitos e vírgula) é mês/dia; o resto, dia/mês (o padrão do Brasil).
function ordemDoArquivo(linhas) {
  if (ordemForcada) return ordemForcada;
  let dmy = false, mdy = false, ingles = false;
  for (const l of linhas) {
    const m = l.match(INICIO_SIS);
    if (!m) continue;
    if (+m[1] > 12) dmy = true;
    if (+m[2] > 12) mdy = true;
    if (/^\d{1,2}\/\d{1,2}\/\d{2}, \d/.test(l)) ingles = true;
  }
  if (mdy !== dmy) return mdy ? "mdy" : "dmy";
  return ingles ? "mdy" : "dmy";
}

function parse(texto) {
  const linhas = texto.replace(/\r/g, "").replace(INVISIVEIS, "").split("\n");
  const ordem = ordemDoArquivo(linhas);
  const msgs = [];
  for (const linha of linhas) {
    const m = linha.match(INICIO);
    if (m) {
      let [, a, b, y, h, mi, ap, quem, corpo] = m;
      const [d, mo] = ordem === "mdy" ? [b, a] : [a, b];
      if (y.length === 2) y = "20" + y;
      if (ap) { h = String((+h % 12) + (ap.toLowerCase() === "p" ? 12 : 0)); }
      msgs.push({ data: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, hora: `${h.padStart(2, "0")}:${mi}`, quem: quem.trim(), corpo: corpo.replace(EDITADA, "") });
    } else if (INICIO_SIS.test(linha)) { /* linha de sistema: ignora */ }
    else if (msgs.length) msgs[msgs.length - 1].corpo += "\n" + linha.replace(EDITADA, "");
  }
  return { ordem, msgs: msgs.filter((m) => !SISTEMA.test(m.corpo.trim())) };
}

const sem = (s) => s.toLowerCase().normalize("NFC");
const cita = (m) => { const t = sem(m.corpo + " " + m.quem); return nomes.some((n) => t.includes(n)); };
// [A?]: tira as @marcações (já cobertas pelo [A]) e procura palavra inteira.
const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reTalvez = talvez.length ? new RegExp(`(^|[^\\p{L}])(${talvez.map(escapa).join("|")})(?![\\p{L}])`, "iu") : null;
function citaTalvez(m) {
  if (!reTalvez) return false;
  let t = sem(m.corpo).replace(/@~?[^\s@]+(\s[^\s@]+)?/g, " ");
  for (const x of nao) t = t.split(x).join(" ");
  return reTalvez.test(t);
}
const geral = (m) => CHAVES.test(m.corpo);
const corta = (s) => s.replace(/\n+/g, " ⏎ ").slice(0, 450);
const br = (iso) => iso.split("-").reverse().join("/");

const arquivos = readdirSync(pasta).filter((f) => /\.txt$/i.test(f));
if (!arquivos.length) { console.error(`Nenhum .txt em ${pasta}/`); process.exit(1); }
if (paraBot) mkdirSync(join(pasta, "_bot"), { recursive: true });

let saida = `# Conversas filtradas (${new Date().toISOString().slice(0, 10)})\nNomes: ${nomes.join(", ")}${talvez.length ? ` · talvez: ${talvez.join(", ")}` : ""}${desde ? ` · desde ${desde}` : ""}\n[A] cita você (com a mensagem de antes e de depois) · [A?] nome solto que talvez seja você · [B] aviso geral com valor, pix, prazo etc.\n`;
let totalMsgs = 0, totalSaida = 0, totalA = 0;
for (const f of arquivos) {
  const { ordem, msgs: todas } = parse(readFileSync(join(pasta, f), "utf8"));
  const msgs = todas.filter((m) => !desde || m.data >= desde);
  const marca = new Map();
  msgs.forEach((m, i) => {
    const tipo = cita(m) ? "A" : citaTalvez(m) ? "A?" : "";
    if (tipo) { for (const j of [i - 1, i + 1]) if (msgs[j] && !marca.has(j)) marca.set(j, "ctx"); marca.set(i, tipo); }
    else if (geral(m) && !marca.has(i)) marca.set(i, "B");
  });
  const vistos = new Set();
  const escolhidas = [...marca].sort((a, b) => a[0] - b[0]).map(([i, t]) => ({ m: msgs[i], t })).filter(({ m }) => {
    const k = m.quem + "|" + m.corpo; if (vistos.has(k)) return false; vistos.add(k); return true;
  });
  const linhas = escolhidas.map(({ m, t }) => `${m.data} ${m.hora} [${t === "ctx" ? "·" : t}] ${m.quem}: ${corta(m.corpo)}`);
  const nA = escolhidas.filter(({ t }) => t === "A").length;
  totalMsgs += msgs.length; totalSaida += linhas.length; totalA += nA;
  const titulo = f.replace(/^Conversa do WhatsApp com |\.txt$/gi, "");
  saida += `\n## ${titulo}\n(${msgs.length} mensagens, ${linhas.length} ficaram, ${nA} citam você; data lida como ${ordem === "mdy" ? "mês/dia" : "dia/mês"})\n${linhas.join("\n")}\n`;
  if (paraBot && escolhidas.length) {
    const txt = escolhidas.map(({ m }) => `${br(m.data)} ${m.hora} - ${m.quem}: ${m.corpo}`).join("\n");
    writeFileSync(join(pasta, "_bot", f), txt + "\n");
  }
}
writeFileSync(join(pasta, "_filtrado.md"), saida);
console.log(`${arquivos.length} conversa(s): ${totalMsgs} mensagens → ${totalSaida} linhas (${totalA} citam você) em ${pasta}/_filtrado.md (${Math.round(saida.length / 1000)} mil caracteres)`);

// Filtra conversas exportadas do WhatsApp (.txt, "sem mídia") e deixa só o que
// pode ser cobrança, num arquivo pequeno pra ler de uma vez (sem gastar token
// com papo de grupo). Não usa internet nem API: roda no seu computador.
//
// Uso:
//   node scripts/filtrar-whatsapp.mjs "larimii,lari" [pasta] [--desde AAAA-MM-DD]
//   (pasta padrão: _whatsapp ; saída: _whatsapp/_filtrado.md)
//
// Entra no resultado:
//   [A] mensagem que cita um dos seus nomes (e a mensagem logo antes e depois)
//   [B] aviso geral com valor em R$, pix, prazo, frete, taxa, liberação etc.
// Funciona com o formato do Android ("12/10/2026 14:05 - Nome: texto") e do
// iPhone ("[12/10/2026 14:05:33] Nome: texto").
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const iDesde = args.indexOf("--desde");
const desde = iDesde >= 0 ? args.splice(iDesde, 2)[1] : "";
const nomes = (args[0] || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const pasta = args[1] || "_whatsapp";
if (!nomes.length) { console.error('Faltou os seus nomes: node scripts/filtrar-whatsapp.mjs "nome1,nome2"'); process.exit(1); }

const CHAVES = /cobran[çc]a|frete|taxa|\bpix\b|pagamento|pagar|\bpag[oa]s?\b|prazo|multa|armazen|comprovante|liberad|fechou|fechamento|vencimento|r\$\s*\d|\d+[.,]\d{2}\s*(reais)?|\bpaypal\b|\bboleto\b|\bdevendo\b|atras/i;
const SISTEMA = /criptografia|mudou o [íi]cone|entrou usando|saiu$|foi removido|adicionou|apagou esta mensagem|mensagem apagada|<m[íi]dia oculta>|imagem ocultada|figurinha omitida/i;
const INICIO = /^‎?\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,]?\s+(\d{1,2}):(\d{2})(?::\d{2})?(?:\s?[ap]\.?m\.?)?\]?\s*(?:-\s*)?([^:]+?):\s([\s\S]*)$/i;
const INICIO_SIS = /^‎?\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,]?\s+(\d{1,2}):(\d{2})/;

function parse(texto) {
  const msgs = [];
  for (const linha of texto.replace(/\r/g, "").split("\n")) {
    const m = linha.match(INICIO);
    if (m) {
      let [, d, mo, y, h, mi, quem, corpo] = m;
      if (y.length === 2) y = "20" + y;
      msgs.push({ data: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, hora: `${h.padStart(2, "0")}:${mi}`, quem: quem.trim(), corpo });
    } else if (INICIO_SIS.test(linha)) { /* linha de sistema: ignora */ }
    else if (msgs.length) msgs[msgs.length - 1].corpo += "\n" + linha;
  }
  return msgs.filter((m) => !SISTEMA.test(m.corpo));
}

const cita = (m) => { const t = (m.corpo + " " + m.quem).toLowerCase(); return nomes.some((n) => t.includes(n)); };
const geral = (m) => CHAVES.test(m.corpo);
const corta = (s) => s.replace(/\n+/g, " ⏎ ").slice(0, 450);

const arquivos = readdirSync(pasta).filter((f) => /\.txt$/i.test(f));
if (!arquivos.length) { console.error(`Nenhum .txt em ${pasta}/`); process.exit(1); }

let saida = `# Conversas filtradas (${new Date().toISOString().slice(0, 10)})\nNomes: ${nomes.join(", ")}${desde ? ` · desde ${desde}` : ""}\n[A] cita você (com a mensagem de antes e de depois) · [B] aviso geral com valor, pix, prazo etc.\n`;
let totalMsgs = 0, totalSaida = 0;
for (const f of arquivos) {
  const msgs = parse(readFileSync(join(pasta, f), "utf8")).filter((m) => !desde || m.data >= desde);
  const marca = new Map();
  msgs.forEach((m, i) => {
    if (cita(m)) { for (const j of [i - 1, i, i + 1]) if (msgs[j] && !marca.has(j)) marca.set(j, j === i ? "A" : "ctx"); marca.set(i, "A"); }
    else if (geral(m) && !marca.has(i)) marca.set(i, "B");
  });
  const vistos = new Set();
  const linhas = [...marca].sort((a, b) => a[0] - b[0]).map(([i, t]) => ({ m: msgs[i], t })).filter(({ m }) => {
    const k = m.quem + "|" + m.corpo; if (vistos.has(k)) return false; vistos.add(k); return true;
  }).map(({ m, t }) => `${m.data} ${m.hora} [${t === "ctx" ? "·" : t}] ${m.quem}: ${corta(m.corpo)}`);
  totalMsgs += msgs.length; totalSaida += linhas.length;
  saida += `\n## ${f.replace(/^Conversa do WhatsApp com |\.txt$/gi, "")}\n(${msgs.length} mensagens, ${linhas.length} ficaram)\n${linhas.join("\n")}\n`;
}
writeFileSync(join(pasta, "_filtrado.md"), saida);
console.log(`${arquivos.length} conversa(s): ${totalMsgs} mensagens → ${totalSaida} linhas em ${pasta}/_filtrado.md (${Math.round(saida.length / 1000)} mil caracteres)`);

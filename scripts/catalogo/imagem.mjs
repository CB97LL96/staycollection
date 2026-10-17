// Descobre largura e altura de uma imagem baixando só o começo do arquivo.
// Entende WebP, PNG e JPEG, que são os formatos das fontes do catálogo.

export function dimensoes(buf) {
  const b = Buffer.from(buf);
  if (b.length >= 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const tipo = b.toString("ascii", 12, 16);
    if (tipo === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (tipo === "VP8L") {
      const x = b.readUInt32LE(21);
      return { w: (x & 0x3fff) + 1, h: ((x >> 14) & 0x3fff) + 1 };
    }
    if (tipo === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  }
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

// Baixa os primeiros bytes (JPEG às vezes guarda o tamanho mais pro meio).
export async function medir(url) {
  for (const bytes of [1023, 65535]) {
    const r = await fetch(url, { headers: { Range: `bytes=0-${bytes}`, "User-Agent": UA } });
    if (r.status === 404) return null;
    if (!r.ok && r.status !== 206) throw new Error(`${r.status} ${url}`);
    const d = dimensoes(await r.arrayBuffer());
    if (d) return d;
  }
  return null;
}

export const UA = "staycollection-catalogo/1.0 (+https://github.com/CB97LL96/staycollection)";

// Roda tarefas com um limite de pedidos simultâneos, pra não sobrecarregar os sites.
export async function emLotes(lista, limite, fn) {
  const out = new Array(lista.length);
  let i = 0;
  await Promise.all(Array.from({ length: limite }, async () => {
    while (i < lista.length) { const k = i++; out[k] = await fn(lista[k], k); }
  }));
  return out;
}

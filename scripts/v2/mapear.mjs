// Leva os registros do app atual (tabela "docs", um JSON por registro) para
// as tabelas do modelo novo (supabase/v2.sql). A lógica mora em
// v2-codec.js (um arquivo só, igual no navegador e aqui); este arquivo só a
// expõe como módulo. Quem lê e grava no Supabase é o scripts/migrar-v2.mjs.
import "../../v2-codec.js";

const C = globalThis.StayV2;
export const { norm, valor, separarGoms, mapear, paraDocs, escrever, apagarDoc, ORDEM, TABELAS, PK, pkDe, pkVal, COLS_DOCS, DEPENDE, tabelasDe, mapas, semPix, curto } = C;
export default C;

// Endereço e chave pública ("anon" / "publishable") do projeto no Supabase.
// Supabase > Project Settings > API. Essa chave foi feita pra ficar no site:
// quem protege os dados são as regras do banco (supabase/schema.sql).
// Nunca colocar aqui a chave "service_role" / "secret".
//
// dataModel: qual modelo de dados o app usa.
//   "docs" (padrão): a tabela "docs", como sempre foi.
//   "v2": as tabelas novas (supabase/v2.sql). Só ligar depois de seguir o
//         docs/MIGRACAO.md. Pra voltar, troque por "docs" (os dados antigos
//         continuam lá; veja o passo "como voltar").
window.STAY_CONFIG = {
  dataModel: "docs",
  supabaseUrl: "https://rcdreaphagooklgcjsuc.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZHJlYXBoYWdvb2tsZ2Nqc3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMDA1MjgsImV4cCI6MjEwNzU3NjUyOH0.p0sRMy65ocg0GforUreUQ88sfd_MT0dv9apbson5RNc",
};

# staycollection

gestão de coleção e cegs de uma stay com tdah

Começou como o artefato "Coleção SKZ" no claude.ai e está sendo migrado para rodar no Vercel.

## O que tem aqui

- `index.html`: o app inteiro (HTML, CSS e JS num arquivo só, sem build).
- `backend.js` e `config.js`: ligam o app ao Supabase (banco, login com Google e fotos).
- `supabase/schema.sql`: cria o banco. Roda uma vez no SQL Editor do Supabase.
- `importar.html`: importa o backup exportado do artefato do claude.ai.
- `ler.html` e `api/ler.js`: teste da leitura de mensagens e prints pela API do Claude.
- `colecao.json`: catálogo de photocards (fonte: CraftenSKZ / StrayKidsPCCollector).
- `blobs/`: as folhas de fotos do catálogo de photocards, que ficavam no artefato. O `vercel.json` faz o endereço antigo `/_blob/<id>` apontar pra `blobs/<id>.jpg`, então os dados não precisaram mudar.

## Como colocar no ar

### 1. Supabase
1. Criar um projeto em supabase.com (região São Paulo).
2. SQL Editor > New query: colar `supabase/schema.sql` e rodar.
3. Login com Google: em Authentication > Sign In / Providers > Google. Pede um
   "OAuth client" criado no Google Cloud Console, com o endereço de retorno que
   o próprio Supabase mostra nessa tela.
4. Authentication > URL Configuration: em "Site URL", o endereço do Vercel.
5. Project Settings > API: copiar a "Project URL" e a chave "anon" / "publishable"
   pro `config.js`.
6. Depois de entrar pela primeira vez, desligar "Allow new users to sign up",
   pra ninguém mais criar conta.

### 2. Vercel
1. Importar este repositório (sem build, sem framework).
2. Settings > Environment Variables:
   - `ANTHROPIC_API_KEY`: chave da API do Claude (console.anthropic.com)
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY`: os mesmos do `config.js`
   - `ALLOWED_EMAILS`: o seu e-mail (quem pode usar a leitura)
   - `MEUS_NOMES`: como você aparece nas planilhas e grupos, separado por vírgula

### 3. Dados
Abrir `/importar.html` no site, entrar e escolher o arquivo de backup.

## Rodar localmente

```sh
python3 -m http.server 8000
```

e abrir http://localhost:8000 (a leitura pela API só funciona no Vercel).

## Pendências

- **Cobranças: fluxo de checkout em lote, feito em 17/10/2026.** A visão em
  cartões agrupados (`cobBoard`) já existia; faltava o "fluxo parecido com um
  checkout" descrito aqui. Agora dá pra selecionar várias cobranças "Pendente"
  da mesma comunidade (checkbox em cada cartão), ver o total e o pix dessa
  comunidade numa barra fixa, e liquidar todas de uma vez (com confirmação em
  dois passos e desfazer por alguns segundos). Também corrigido: escrita
  otimista sem rollback em caso de falha de rede, rótulo errado do controle
  "Agrupar/Ordenar", "você pagou?" sem opção pra incerteza, e zero explicação
  do conceito de confiança/conferência.
  Em aberto: a seleção em lote é só da sessão (não fica salva no banco); se
  fizer sentido guardar quais cobranças foram liquidadas juntas (pra
  histórico/auditoria), precisa de um campo novo em `supabase/schema.sql`
  (ex.: `lote`) — decisão de propósito deixada pra depois.

- **Manter o catálogo atualizado sozinho.** O catálogo vem do CraftenSKZ
  (github.com/CraftenSKZ/StrayKidsPCCollector), que é aberto. Dá pra criar uma
  rotina que confere de tempos em tempos se ele mudou e regenera o
  `colecao.json` e as folhas de fotos. Também falta completar com SG, fankit,
  pop up, eventos e merch (outras fontes).

## Cuidado: o repositório é público

Nunca commitar dados pessoais: chaves Pix, nomes, grupos de WhatsApp,
comprovantes, exports do banco. Backups ficam fora do git (veja `.gitignore`).


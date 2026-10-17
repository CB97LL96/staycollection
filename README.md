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

- **Redesenhar a página de Cobranças.** É a parte mais importante do app, e a
  usabilidade está confusa. O redesenho começou no artefato em 14/10/2026,
  mas não chegou a ser publicado, então o `index.html` daqui ainda tem a
  versão antiga. A ideia que estava em andamento: cartões de cobrança
  agrupados e um fluxo parecido com um checkout. Idear antes de implementar.

- **Completar o catálogo com outras fontes.** Próxima: Bibliocards (memberships,
  fanclub, SG japonês, MD, revistas e collabs). Depois o Bias Room, pelo Chrome
  da Lari, só pra nomes e versões. Muitas fotos ainda são pequenas (abaixo de
  300px), sobretudo de Karma, DO IT e THIS & THAT.

## Catálogo de photocards

O `colecao.json` é gerado por `node scripts/catalogo/gerar.mjs`, que lê as fontes
em `scripts/catalogo/fontes/`, junta os cards repetidos (mesma era, versão e
membro) e escolhe a foto de maior resolução. Das fontes guardamos só o link da
foto. Os códigos dos cards nunca mudam, porque as marcações e os pedidos apontam
pra eles. O tamanho de cada foto fica guardado em `scripts/catalogo/imagens.json`
pra não medir tudo de novo.

A rotina `.github/workflows/catalogo.yml` roda toda segunda de manhã (e pelo
botão "Run workflow" na aba Actions do GitHub) e salva no `main` quando alguma
fonte muda. O Vercel publica sozinho em seguida.

## Cuidado: o repositório é público

Nunca commitar dados pessoais: chaves Pix, nomes, grupos de WhatsApp,
comprovantes, exports do banco. Backups ficam fora do git (veja `.gitignore`).


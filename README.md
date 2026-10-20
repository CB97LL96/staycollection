# staycollection

gestão de coleção e cegs de uma stay com tdah

Começou como o artefato "Coleção SKZ" no claude.ai e está sendo migrado para rodar no Vercel.

## O que tem aqui

- `index.html`: o app inteiro (HTML, CSS e JS num arquivo só, sem build).
- `backend.js` e `config.js`: ligam o app ao Supabase (banco, login com Google e fotos).
- `supabase/schema.sql`: cria o banco. Roda uma vez no SQL Editor do Supabase.
- `importar.html`: importa o backup exportado do artefato do claude.ai.
- `ler.html` e `api/ler.js`: teste da leitura de mensagens e prints pela API do Claude.
- `colecao.json`: catálogo de photocards. **Gerado automaticamente** a partir
  do Supabase (tabela `catalogo_itens`) + `data/catalogo-fotos.json` (as
  folhas de fotos, que não mudam de fonte) — não editar à mão, veja
  "Catálogo: como atualizar" abaixo.
- `scripts/catalogo-core.mjs`: lógica compartilhada do catálogo (buscar no
  CraftenSKZ, ler/gravar no Supabase, gerar o `colecao.json`).
- `scripts/sync-catalogo.mjs`, `scripts/exportar-catalogo.mjs`,
  `scripts/migrar-catalogo-supabase.mjs`, `scripts/migrar-eventos-timeline.mjs`:
  veja "Catálogo: como atualizar".
- `api/cron/sync-catalogo.js`: roda sozinho na Vercel (cron em `vercel.json`),
  sincroniza com o CraftenSKZ e comita o `colecao.json` atualizado no GitHub.
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
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase > Project Settings > API, a chave
     **service_role** (secreta — nunca a "anon" do `config.js`; só o cron usa)
   - `GITHUB_TOKEN`: um personal access token (fine-grained) com permissão
     "Contents: Read and write" neste repositório
   - `GITHUB_REPO`: `usuario/repositorio` (ex.: `CB97LL96/staycollection`)
   - `CRON_SECRET`: qualquer texto secreto (a Vercel manda ele automaticamente
     como `Authorization: Bearer` pros cron jobs definidos em `vercel.json`)

### 3. Dados
Abrir `/importar.html` no site, entrar e escolher o arquivo de backup.

## Catálogo: como atualizar

O catálogo de photocards vive no Supabase (tabela `catalogo_itens`); o
`colecao.json` que o app lê é só um "export" gerado dali + das folhas de
fotos fixas (`data/catalogo-fotos.json`). Isso existe porque a Vercel não
deixa uma função gravar arquivo em runtime — então quem muda de verdade é o
banco, e um passo separado regenera o arquivo estático.

Pra rodar os scripts abaixo localmente, exporte no terminal:
```sh
export SUPABASE_URL="..."              # Supabase > Project Settings > API
export SUPABASE_SERVICE_ROLE_KEY="..." # idem, chave service_role (secreta)
```

- **Primeira vez** (uma única vez, depois de rodar `supabase/schema.sql`):
  `npm run migrar-catalogo-supabase` — leva o `colecao.json` que já existe
  pro Supabase, sem perder nada (inclui a posição de foto de cada item).
- **Conferir se o CraftenSKZ tem item novo**: `npm run sync-catalogo`
  (dry-run; `-- --apply` grava no Supabase). Na Vercel isso roda sozinho
  todo dia (`api/cron/sync-catalogo.js`), e já comita o `colecao.json`
  atualizado no GitHub.
- **Atualizar o `colecao.json` local** a partir do que está no Supabase, sem
  usar o cron: `npm run exportar-catalogo`.
- **Linha do tempo de eventos** (fanclube, pop-up, Season's Greetings,
  merch, collab, turnê — categorias que o CraftenSKZ não tem):
  `npm run migrar-eventos-timeline` importa a planilha "SKZ Era Timeline"
  (mantida por terceiros, compartilhada com a sua conta do Google) pra
  tabela `catalogo_eventos`. Pode rodar de novo quando ela atualizar a
  planilha; cada execução substitui as linhas antigas, nunca duplica. A aba
  "Pop-Ups" da planilha fica de fora de propósito: cruzei com a wiki
  (abaixo) e as 26 páginas de "Merch events" cobrem o mesmo conjunto de
  pop-ups com mais detalhe — importar as duas geraria evento repetido.
- **Season's Greetings e pop-ups, com nome oficial confirmado** (sem
  precisar de X nem de imagem): `npm run migrar-wiki-skz` lê
  stray-kids.fandom.com pela API pública do MediaWiki (sem login, sem
  navegador) — a página "Season's Greetings" (nome oficial, data,
  editora/distribuidora, preço e o conteúdo item a item de cada edição,
  Coreia e Japão, 2021 até a mais recente já anunciada) e as 26 páginas da
  categoria "Merch events" (pop-up, café, exposição, com data e local). Vai
  pra `catalogo_eventos` também. Idem: roda de novo quando a wiki mudar,
  substitui sem duplicar.
- **`api/cron/sync-eventos.js`**: roda sozinho na Vercel, toda segunda
  (`vercel.json`), e reimporta as duas fontes acima (planilha + wiki). Não
  precisa comitar nada no GitHub — essas mudam bem menos que o CraftenSKZ e
  `catalogo_eventos` ainda não vira arquivo estático.
- **`docs/fontes-catalogo.md`**: lista todas as fontes mapeadas pro
  catálogo (automatizadas, mapeadas mas não processadas, ou bloqueadas),
  com os links/ids exatos — contas do X, Pinterest, pastas do Drive da
  usuária, pocamarket, Mercari. Consultar antes de sair procurando essas
  fontes de novo.

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
  Em aberto, resolvido em 18/10/2026: a ideia de "lote" era por dia, não por
  seleção exata — cada cobrança paga já guarda `pagoEm`, então não precisou de
  campo novo. A seção "Pagas" agora agrupa por dia (`pagoEm`), mostrando
  quantas cobranças e o total de cada dia; pagar várias coisas em sequência no
  mesmo dia já aparece como um lote, mesmo sem ter passado pelo checkout em
  lote.

- **Manter o catálogo atualizado sozinho — CraftenSKZ, automatizado em
  19/10/2026.** O catálogo (`catalogo_itens`) agora mora no Supabase; o
  `colecao.json` é gerado a partir dele. `api/cron/sync-catalogo.js` roda
  todo dia na Vercel, confere os 4 arquivos do CraftenSKZ, grava item novo
  no banco e comita o `colecao.json` atualizado no GitHub (dispara redeploy
  normal). Só adiciona — nunca remove nem reescreve item existente, pra não
  perder a posição da foto nem o id de nada já ligado a uma coleção. Item
  novo entra sem foto. Veja "Catálogo: como atualizar".

- **SG e pop-up/eventos — resolvido com nome oficial confirmado, em
  19/10/2026.** A planilha "SKZ Era Timeline" (terceiros) deu o esqueleto
  cronológico 2017–2026, mas parava antes da era "This & That" (ago/2026) e
  é em nível de evento, sem o texto oficial de cada edição. Achamos melhor:
  a wiki stray-kids.fandom.com tem uma página "Season's Greetings" com nome
  oficial, data, editora/distribuidora, preço e conteúdo item a item de cada
  edição (Coreia e Japão, 2021 até 2027 já anunciada), e uma categoria
  "Merch events" com 26 pop-ups/cafés/exposições (incluindo "THIS & THAT
  POP-UP STORE", que a planilha não tinha). Tudo pela API pública do
  MediaWiki, sem login, sem X, sem adivinhar nome — exatamente o padrão de
  confiança que a usuária pediu. Importado em `scripts/migrar-wiki-skz.mjs`
  pra `catalogo_eventos`.
  Em aberto: isso é em nível de evento/edição, não per-membro (ex.: sei que
  a SG "Room,mates" de 2022 veio com Magnet, Polaroid Set etc., mas não qual
  foto específica cada membro teve). A wiki também tem páginas individuais
  de linhas de merch (SKZOO, Nachimbong, Heart Monster, Sukichuu, DICON) que
  ainda não processei — próximo passo natural se fizer sentido ir mais a
  fundo no "merch"/"fankit" por linha de produto.
  Fica de lado por ora: as imagens de template do Google Drive da usuária
  (não têm nome de versão, só contagem visual) e os PDFs de scan físico
  (centenas de MB, grandes demais pra processar automaticamente) — úteis só
  pra consulta manual de foto depois.

- **Conta @shoyoskz no X — decisão da usuária, não implementado ainda.**
  Fonte de novidade em tempo real (blur, pop-up anunciado, POB saindo),
  importante porque a usuária compra/dá claim em item antes de sair foto
  oficial. Relevante a partir da era Karma (ago/2025) pra cá. Plano
  combinado: API paga do X (pay-per-use, baratou bastante em 2026) + Claude
  classificando/extraindo o que é relevante (ela posta sobre outros assuntos
  também), guardado como sugestão pendente pra usuária confirmar — nunca
  direto no catálogo, porque "blur" por definição não é confirmado. Falta:
  a usuária criar a conta de desenvolvedor do X e passar o token; eu
  monitoro as outras contas/sites que achamos (@skzot8templates, @onged95 /
  skzpclist.carrd.co) pra ver se algum link dela leva a outro lugar que
  também valha monitorar.

- **Preço/link da POCA MALL — automatizado em 20/10/2026.** A usuária pediu
  que fosse automático, mas só de itens da Stray Kids (o site vende de
  vários grupos). `scripts/migrar-pocamarket.mjs` lê `mall.pocamarket.com`
  (renderizado no servidor, dados do produto já vêm como JSON no HTML, sem
  precisar de navegador) e filtra pelo campo `brand` do produto, não pelo
  texto da busca. Grava em `catalogo_loja` (preço atual, preço de tabela,
  link, foto, se é pré-venda), lido pelo app em `api/loja.js` e mostrado na
  aba Loja da Coleção. Reimporta inteiro a cada execução — é o que está à
  venda agora, não histórico. Roda junto do cron semanal de eventos (ver
  "Catálogo: como atualizar").
  Pendente da usuária: a tabela `catalogo_loja` ainda precisa ser criada no
  Supabase (rodar o trecho novo de `supabase/schema.sql`) e a primeira
  importação rodada uma vez (`npm run migrar-pocamarket`) antes disso
  aparecer no site.
  Em aberto: fotos do Mercari como fonte complementar pra itens sem foto —
  não iniciado; a usuária deixou a estratégia de busca em aberto pra quem
  for implementar (ideia: buscar por nome + membro + era do item específico
  que falta foto, não uma varredura geral do catálogo).

- **Qual fonte de scan tem a cor mais fiel ao photocard real — pedido da
  usuária, não iniciado.** Ela listou várias contas de Pinterest de scan
  (skzpicsarchive, skzpcs, hhjiinn, V1RGWHORE, S0325_2018, cookyartt__) pra eu
  comparar no futuro e dizer qual bate mais com a cor real (scan às vezes
  sai errado). Depende de acessar essas contas e comparar imagem a imagem —
  trabalho de curadoria visual, não de automação.

## Cuidado: o repositório é público

Nunca commitar dados pessoais: chaves Pix, nomes, grupos de WhatsApp,
comprovantes, exports do banco. Backups ficam fora do git (veja `.gitignore`).


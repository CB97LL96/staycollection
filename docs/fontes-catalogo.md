# Fontes do catálogo (fora do CraftenSKZ)

Levantamento feito em 19/10/2026. Lista tudo que já foi mapeado pra
preencher o catálogo além de álbum/POB (que o CraftenSKZ já cobre sozinho,
via `scripts/sync-catalogo.mjs`). Cada fonte diz o que tem, o estado
(automatizada / mapeada mas não processada / bloqueada) e, se for o caso,
o id/link exato.

## Automatizadas (scripts já no repo, rodam de novo sem duplicar)

| Fonte | O que dá | Script |
|---|---|---|
| CraftenSKZ / StrayKidsPCCollector (GitHub, aberto) | Álbum + POB coreano/japonês, item a item | `scripts/sync-catalogo.mjs` (cron diário na Vercel) |
| Planilha "SKZ Era Timeline" (Google Sheets, de clemgraces@gmail.com, compartilhada) — id `1-DaPkuhrpA6yHgYjzPXm9ac_L_Uc-1mmIVVKtBb09M8` | Linha do tempo 2017–2026: fanclube, SG, merch, collab, turnê — nível de evento. Parava antes da era "This & That" (ago/2026) na última conferência. A aba "Pop-Ups" dela **não é importada**: cruzei com a wiki e as 26 páginas de "Merch events" cobrem o mesmo conjunto de pop-ups com mais detalhe (importar as duas geraria evento duplicado). | `scripts/migrar-eventos-timeline.mjs` |
| stray-kids.fandom.com (wiki, API pública do MediaWiki) | Página "Season's Greetings": nome oficial, data, editora/distribuidora, preço, conteúdo item a item (Coreia+Japão, 2021–2027). Categoria "Merch events": 26 pop-ups/cafés/exposições com data e local, incluindo "THIS & THAT POP-UP STORE". | `scripts/migrar-wiki-skz.mjs` |

## Mapeadas na mesma wiki, ainda não processadas

Páginas individuais por linha de merch (teriam o mesmo padrão `{{Infobox
Item}}` da Season's Greetings, dá pra reaproveitar o parser):
- `SKZOO`, `Nachimbong`, `Heart Monster`, `Sukichuu`, `DICON Volume N°21`
- `Category:Photobooks`, `Category:DVDs & Blu-rays`

Também não explorada: `en.namu.wiki/w/Stray_Kids` (wiki coreana, pode ter
informação que a fandom.com em inglês não tem).

## Redes sociais e sites de fã (bloqueados pra leitura automática direta)

| Conta/site | Pra que serve | Situação |
|---|---|---|
| `@shoyoskz` (X) | Notícia em tempo real: blur, pop-up anunciado, POB saindo. Foco útil a partir da era Karma (ago/2025). | Precisa de API paga do X (pay-per-use, ficou barato em 2026) ou navegador logado — deixado por último por decisão da usuária. |
| `@skzot8templates` (X) + `skzot8templates.carrd.co` | Templates por categoria, Drive hospedado. | Mesma limitação do X; o carrd em si é só navegação, sem dado estruturado. |
| `@onged95` (X/Pinterest) + `skzpclist.carrd.co` | Lista de photocard+merch+SG+pop-up com link pro post original do X de cada item — seria a melhor forma de confirmar nome de versão item a item. | Bloqueado: ler o post do X individual dá HTTP 402 (sem API paga ou navegador logado). |

## Google Drive da usuária (pastas de template/scan de outras fãs)

Sem nome de versão confiável por si só (são imagens, às vezes um compilado
de vários itens numa imagem só) — úteis pra contagem visual, referência de
foto, ou cruzamento com uma fonte textual (wiki/CraftenSKZ já dão o nome).

**Organizadas por era/membro (mais recentes, até fev/2026):**
- "SKZ Templates" (ejbell090101@gmail.com) — pasta raiz
  `1QT3s49UxqXKSZzBbtSA0wetYT2ApI6XQ`. Dentro: "Korean album"
  (`1-hv6JzZJnR3AmfcJvxmH0kojZwQ4yRwv`) com subpastas por era — Do It
  (`1Ernj-FryM-rKMewkfP7p9ywi3AluMZzh`), Karma
  (`1vns4X6fWtePc_cH166mFKK444Hngqfxz`), No Easy
  (`11jNwff7-djv_V4kZC3ejy5zi02LBwJuj`), Hop
  (`11ewd5uWq5L-MOH9LmnHo9J9WEI1c4aNA`), "Complete Korean Album (member)"
  (`10AI4Aay3vvRzkOJJK8o4FiqoVW4GfZ02`, subpastas por membro com scans
  soltos, menos curado). Também "Seasons Greetings"
  (`11fhv_BkIx3f8y39A_0v92NZU5rGP8XYO`, compilado 2021–2026 por membro),
  "Fanmeetings" (`1-M6wCel9YRPkLU25dR-Ly6MIR1cyyH1m`), "Tour"
  (`102rXoWMOCcCCdzyrNuPJBFoXGGusJcuP`), "ISO Templates"
  (`10H3L0WkODlQADeX3O0x8KDHtEkG0_Rop`, versões pra Instagram story).
- "THIS&THAT TEMPLATES" (hyunjinnie.1996@gmail.com) —
  `1JmxKlpJETg35xqu6-1_67n2NfRHG0kSR`, criada ago/2026 — provavelmente a
  mais atual pra essa era, ainda não aberta.
- "Template by egaaaays" (egaaaays@gmail.com) —
  `18zn693MWPikaTa8hI3H8kL776AuD2zMm`, dez/2025 — não aberta.

**Mais antigas / paradas (baixa prioridade, o CraftenSKZ já cobre o período):**
- "templates" (hwajinsales@gmail.com) — `1-Dzjo89_KkLu6sIdoeKEuvbY0nb55dIF`, parada 2022.
- "complete inclusions" / "scans" (nailamusicvideos@gmail.com) —
  `1aoCSRg85dYwKjKmgh6FYk_g4W89_Yium` / `1UVTHYKqdz8aNe294VdhoQIg3PheONyvI`, parada 2022.
- "TEMPLATES" (templates4kpop@gmail.com) — `1-4e30goAPwI0Y8RQf58OUIA7OFd6Pe9e`, última edição mai/2024.
- "TEMPLATES" / "PC TEMPLATES" (roadsabrina@gmail.com) —
  `1oI-Ne3lMPSj8rW9wvFuCsyM3LVF7a1ZX` / `1NF9YaQmmoZ_UI8j3l-1XZ7ALA3MV6GW4`, parada 2022.

**Scans físicos (foto, não dado estruturado):**
- "SKZ Scans" (20dollarchicken@gmail.com) — `1NhuVvCOoQ4Qa8zKEQl8M5oxyUdThsxvG`,
  criada nov/2025. PDFs de scan físico enormes (quase 1GB cada, ex. pasta
  "DO IT ALBUM" `1ETltm7u9k-dKnUdCW6bdjg-AspD66KAq`) — grandes demais pra
  processar automaticamente.
- "stray kids scans" (skzscans0318@gmail.com) — `1gnpfMC6eZmdUSolwSpABnn8LSI8_yvMP`.
- "SCAN" (shintiamalombeke@gmail.com) — `1IrpnLGfQqyctgVV2XoEG_VEfwtMV5KH-`.
- "SCANS" (templates4kpop@gmail.com) — `1y36M1v6x60oQPFwcU2fUyrpTYo-SbzNn`.
- "Stray Kids scans - @lkscans" (sophiesnooz@gmail.com) — `13ldqtmUs76_GFAqCUBKgqMgoNMo4_JRg`.

Nenhuma dessas 4 últimas foi aberta ainda (só confirmei que existem e são
sobre Stray Kids).

**Pinterest de scan** (pra comparar no futuro qual bate mais com a cor real
do photocard — scan às vezes sai errado): `skzpicsarchive` (tabuleiro
`/scans/`), `skzpcs`, `hhjiinn` (`/skz-photocards/`), `V1RGWHORE`
(`/skz-photocard-scans/`), `S0325_2018`, `cookyartt__`.

## Outras lojas/sites

- **POCA MALL (mall.pocamarket.com)** — automatizado em 20/10/2026. A busca
  do site é renderizada no servidor (Next.js) e já embute os dados do
  produto (nome, preço, preço de tabela, link, foto) como JSON no próprio
  HTML — não precisa de navegador nem de API paga. `scripts/migrar-
  pocamarket.mjs` busca `/en/search?q=Stray%20Kids` e filtra pelo campo
  `"brand":"Stray Kids"` do próprio JSON (não confia só no texto da busca),
  pra `catalogo_loja`. Reimporta inteiro a cada execução (apaga e grava de
  novo): é um retrato do que está à venda agora, não um histórico — item
  que sai de linha simplesmente some da tabela. Rodado junto do cron
  semanal de eventos (`api/cron/sync-eventos.js`) pra não passar do limite
  de cron jobs do plano Hobby da Vercel.
- **Mercari** — fonte de foto/merch pra itens que não tem em outro lugar,
  ainda não iniciado. A usuária deixou a estratégia de busca a critério de
  quem for implementar; ideia: por nome + membro + era do item que falta
  foto, não uma varredura geral do catálogo.

## O que foi descartado

Um dos links de pasta do Drive que vieram junto (`17YgJyDPdgLISUJMQDK51CCpWcTp_Q5in`,
"Templates" dentro de "PDV") era uma pasta de trabalho da Agência Moldura
(cliente "PDV"), sem relação com Stray Kids — removido desta lista.

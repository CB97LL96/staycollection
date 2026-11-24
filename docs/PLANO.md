# Plano do staycollection

Leia isto no começo de cada chat novo. O README explica como cada parte funciona;
este arquivo diz **o que já está pronto e o que vem depois**.

## Antes de mexer: sincronizar o Git
O projeto existe em dois lugares: o Codespace (`/workspaces/staycollection`) e a
pasta do computador. O Codespace é o que tem o login do GitHub e faz o push. Na
pasta do computador, rode **`git pull`** antes de qualquer coisa (já está
configurado para fazer rebase). Quem abrir um chat novo aqui: lembre a Lari
disso na primeira mensagem, ela pediu pra não depender de memória.

## Regras do projeto
- O repositório é **público**. Nada de dado pessoal no código: pix, nomes, grupos
  de WhatsApp, comprovantes, backups, `.env.local`, `_whatsapp/`, perfil do
  paboracha. Dados pessoais ficam no Supabase ou em variáveis da Vercel.
- Chaves secretas vão direto na Vercel ou no Supabase, nunca no chat.
- O robô **sugere**, quem decide é ela: nada muda valor ou marca como paga sem ela
  aceitar na aba "O que devo".
- Toda informação guarda de onde veio (campo `prova`) e quando foi conferida
  (`conferidoEm`).
- Sem force push.

## Já está pronto
- App no ar na Vercel, com dados no Supabase e login Google.
- Cron diário (`api/cron/sync-catalogo.js`) com três tarefas:
  1. catálogo do CraftenSKZ;
  2. conferência das cobranças com as planilhas das GOMs, lendo todas as abas
     visíveis;
  3. conferência do paboracha pela API pública (`scripts/conferir-paboracha.mjs`).
- Bot do Telegram (`api/telegram.js`): ela manda texto, print ou o .txt exportado
  do WhatsApp, e as sugestões aparecem na aba "O que devo".
- Leitura com IA num lugar só (`scripts/ler-core.mjs`, chamando o Gemini grátis
  por `scripts/ia.mjs`; trocado do Claude em 25/10/2026), usada pelo bot e
  pelo `ler.html`. Se o modelo principal estiver lotado, o `ia.mjs` tenta dois
  reservas; a chave é `GEMINI_API_KEY` na Vercel.
- Indicador "atualizado:" no topo do app, por fonte (planilhas, paboracha,
  catálogo, bot, WhatsApp). O bot e os crons carimbam sozinhos
  (`scripts/fontes.mjs`). A leitura feita no navegador (passo 3) **não carimba
  sozinha**: ao terminar, gravar `meta/fontes.whatsapp` (com `ate` = data da
  última mensagem lida) e atualizar `meta/info.atualizadoEm`, senão o app
  mostra a fonte como velha (foi o que deixou "varredura 12/10" parado).
- Passo 3 feito em 24-26/10/2026: grupos de comunidades de CEG e conversas com
  GOMs e vendedoras lidos até 25/10; as 16 sugestões foram aceitas em 30/10, e
  os ajustes que o botão "aceitar" não faz (status, recebimento) foram à mão.

## Próximos passos (em ordem)
1. **Conferir a 1ª rodada do paboracha.** As 5 cobranças em aberto devem aparecer
   como "cobrança nova" ou "é a mesma?". Ver se ficou certo e ajustar a ligação
   automática se errou.
2. **Histórico do WhatsApp.** Ela manda os .txt pro bot. Conferir se as sugestões
   fazem sentido e ajustar o filtro (`encolher` em `api/telegram.js`) se o robô
   deixar coisa de fora.
3. **Ler os grupos do WhatsApp pelo navegador** (versão nova do passo 3, pedida
   em 25/10/2026; **1ª rodada feita**, repetir de 26/10 em diante quando ela
   pedir). Grupos de comunidades, de 11/10 em diante; antes disso só
   onde a base está confusa. Roda numa conversa do Claude Desktop no computador
   dela, seguindo `docs/roteiro-whatsapp.md`.

   Depois disso, o **relatório de cobertura** (plano de verificação). Uma tela ou relatório que
   mostre, pra cada fonte:
   - planilhas: quantas abas o robô leu e em quais achou o nome dela;
   - paboracha: se está tudo ligado;
   - planilhas onde o nome não aparece (ex.: "Han SG japonês 2026").
   
   Também comparar as fontes entre si: cobrança que existe numa e falta na
   outra, ou com valor diferente, vira alerta.
4. **Casos de teste.** Guardar exemplos de erros reais e conferir que continuam
   certos a cada mudança: planilha com várias abas, "9,45" lido como 945, robô
   apagando edição dela.
5. **Reforma da tela de Cobranças.** Feita em 31/10 dentro do redesenho do canhoto
   (ver seção abaixo); falta o fluxo "checkout" de várias cobranças da mesma GOM.
6. **Catálogo** (quando ela quiser):
   - um catálogo só, juntando várias fontes;
   - preferir a melhor informação e a foto de maior resolução;
   - guardar só links das fotos, nunca cópias;
   - Bibliocards;
   - Bias Room só pelo Chrome dela, pra nomes e versões.
   
   Fontes mapeadas em `docs/fontes-catalogo.md`.

## Redesenho "Canhoto de ingresso" (31/10/2026)
Direção em `.impeccable/surfaces/index-html.md`; mundo construído em `DESIGN.md`.
Feito e publicado, cada etapa conferida no app (desktop e, no celular, numa janela de 390 px):
1. `stats()` e uma só conta de "o que devo" (Pendente + "A confirmar" vencido) em Hoje, Devo e Cobranças.
2. Devo abre com a dívida por prazo; sugestões do robô recolhidas, com "aceitar as novas de alta confiança" (pede um segundo toque).
3. Faixa "Vencidos" em Hoje; "desfazer" em selects de status (Itens, Cobranças) e nos botões da Coleção.
4. Celular e acessibilidade: `lang="pt-BR"`, alvos de 44 px, botões fora de `role="button"`, contraste dos contadores.
5. Visual do canhoto (paleta lavanda e petróleo, picote, pílula cheia ou tracejada, carimbo só em vencido, claro e escuro) em Hoje, Devo e Cobranças; Itens e Coleção só ganharam a paleta nova.
6. Cabeçalho com chip-resumo das fontes; Coleção abre em "Tenho + A caminho" (a busca mostra tudo); fontes do Google removidas.

Segunda rodada (31/10/2026, redesenho estrutural, pedido dela): o app passou de 4 áreas e 11 telas para 3 telas.
- **Hoje** é onde se age: total, "Vencidos", "Pagar", "Pedir envio", "Conferir", sugestões do robô (recolhidas) e pagas recentes. Cada canhoto tem as ações na própria linha (copiar pix, pagar, "paguei", "pedi", "ainda devo"), todas com desfazer.
- **Pedidos** é uma lista só, por comunidade: cobranças, envio e itens (por CEG) juntos, com status editável na linha. Filtro "Pra fazer, Esperando, Tudo" e busca. Adicionar cobrança, item ou envio fica no topo.
- **CEGs** voltou como aba própria: tabela por comunidade (GOM, situação, itens, liberados, no Brasil, a caminho, esperando, recebidos, devo), e cada CEG abre a tabela dos itens com status editável.
- **Liquidar em lote** voltou em Pedidos: caixa de seleção nas cobranças Pendentes (uma comunidade por vez), barra com total, dois toques para confirmar, e desfazer.
- **Coleção** continua igual. Comunidades e Repasses viraram "Cadastros", links dentro de Pedidos.
- As telas Devo, Cobranças, Envios e Itens antigas saíram (continuam no histórico do Git). Abas antigas salvas no navegador caem em Hoje ou Pedidos.
- Código novo com prefixo `n-` (canhoto, linha, comunidade). Restos antigos no arquivo, sem uso: `cobBoard`, `envBoard`, `renderList` de cobranças, envios e itens, e CSS antigo.

Falta ou ficou parcial:
- Peso na Coleção: ainda carrega ~11 MB de folhas de sprites (as capas das eras no topo usam ~18 folhas). Hoje, Devo e Cobranças carregam quase nada. Ideia: capas de era menores ou sob demanda.
- O desfazer grava dados dela, então só foi conferido pela sintaxe, não clicado ao vivo.
- CSS ainda tem camadas antigas empilhadas; o bloco "etapa 5" no fim do `<style>` manda. Limpar as camadas velhas é uma etapa à parte.
- Alvos de toque ainda pequenos na Coleção (botão "info" dos cards, mitigado com área de clique maior).
- Não conferi o escuro em Itens e Coleção, nem a faixa de contraste de todos os chips de comunidade (cores por comunidade).

## staycollection 2 (24/11/2026): o que vem agora

A proposta completa, comentada pela dona, está na página "staycollection 2"
(artefato privado dela no claude.ai). Resumo das decisões:

- **Card é a unidade**, organizado em comunidade > GOM > CEG. GOM vira nível próprio.
- **O robô investiga antes de sugerir:** acha a CEG, lê a planilha, compara com o que já
  existe e responde com o total devido na CEG. Nunca grava sozinho.
- **Sem pix:** o app não guarda chave pix nem caminho de comprovante. Só diz em que
  grupo/comunidade olhar. O que ele precisa saber é se ela pagou, e as provas são:
  chat com a GOM, forms respondido ou comprovante do PicPay.
- **Claim ≠ card:** a claim é a linha como a GOM escreveu ("caixa 2", "26 e 27",
  "linguinha"); ela aponta para um ou vários itens. Apelidos confirmados ficam salvos por
  CEG. Na dúvida, o robô pergunta; nunca junta nem separa itens sozinho.
- **Item = a cópia dela** de um card do catálogo. Várias cópias do mesmo card: "repetido"
  é um selo, não um status. Repetido acontece muito e é informação útil.
- **Tudo editável** (Mural e Binder como o board do Figma). Campo editado à mão fica
  travado: o robô não muda sozinho, mas sempre pode sugerir. Notas dela viram contexto
  do robô.
- **Caça de fotos** nas bases mapeadas em `fontes-catalogo.md`; guarda só o link.
- **Celular:** Android. A entrada principal será compartilhar do WhatsApp para o app (PWA).

### Língua do app: a das comunidades
Regra da dona: os textos do app usam os termos das comunidades, não termos inventados.

| use | evite |
|---|---|
| CEG, GOM, claim, set, POB, LD, pc, binder, bias | "compra coletiva", "organizadora", "pedido" |
| cobrança, frete inter, frete nacional, taxa, multa | "conta", "fatura" |
| garantido, na proxy / WH, com a GOM, envio liberado, pedir envio, enviado, recebido | "comigo", "vindo", "liberado" sozinho |
| set não fechou, claim perdida, repasse, repetido, troca | "fora", "cópia" |
| planilha, forms, comprovante, grupo, comunidade | "fonte", "registro" |

Na dúvida sobre um termo, usar o que aparece nas mensagens das GOMs e perguntar a ela.

### Etapas
0. **Modelo novo e migração** (código pronto em 24/11/2026, falta rodar no banco dela):
   - `supabase/v2.sql`: tabelas novas ao lado de `docs` (o app atual não muda).
   - `scripts/v2/mapear.mjs` + `scripts/migrar-v2.mjs` (`npm run migrar-v2`, relatório sem
     gravar; `-- --apply` grava; rodar de novo não duplica nem sobrescreve).
   - Testes: `npm test` (dados inventados). O esquema e a gravação foram testados
     num Postgres local, duas vezes seguidas.
   - Falta: ela rodar `v2.sql` no SQL Editor, depois `npm run migrar-v2` e conferir o
     relatório (CEGs criadas por citação, CEGs ambíguas, valores ilegíveis) antes do
     `--apply`.
1. **Bot que investiga** (código pronto em 24/11/2026, falta deploy):
   - `scripts/investigar.mjs`: acha a CEG por código (nome do grupo no .txt, nome da
     CEG/grupo/GOM/comunidade no texto), monta o dossiê (cobranças, claims, notas dela,
     linhas da planilha com o nome dela, planilha citada na mensagem), a IA diz só o que
     muda, e o total devido na CEG é calculado por código. Alvo inventado pela IA é
     descartado.
   - `api/telegram.js`: responde com CEG, mudanças, total, onde olhar e planilha
     conferida, com botões Aceitar / Não é minha / Ver no app. CEG em dúvida: botões com
     as candidatas, e ele lê de novo com a escolhida.
   - `scripts/aceitar.mjs`: o "Aceitar" do Telegram grava igual ao botão do app, sem pix.
   - App atual: aceita "status novo" de item e mostra CEG e total na sugestão.
   - Cron (`conferir-cobrancas.mjs`): passa por toda CEG com planilha que não acabou,
     sugere cobrança que está na planilha e falta no app (id fixo, não repete), 4 CEGs
     por vez por causa da cota da IA.
   - Testes: `npm test` (24, com IA, Supabase, Telegram e planilha simulados). Não foi
     testado com o Gemini de verdade nem com o banco dela.
   - Deploy: nada de variável nova. Opcional `APP_URL` (padrão
     staycollection.vercel.app). O webhook atual já recebe os toques nos botões.
2. **Mural e colar print** (pronto em 24/11/2026 no branch, falta publicar):
   - Aba **Mural** (`index.html`): itens por GOM, comunidade ou fase; arrastar um card muda de
     CEG ou de fase; soltar uma imagem num card troca a foto; tocar abre a edição rápida
     (nome, membro, fase, CEG, etiquetas, notas). O que ela edita vira "travado"
     (campo `travado` no item); o bot lê notas e travas e só sugere.
   - **Colar print** (`api/print.js`, `scripts/print-core.mjs`): a IA acha cada card, o
     navegador recorta, ela confirma (membro, nome, quais ficam) e os itens nascem com a
     foto, na CEG escolhida, com "desfazer". Ctrl+V no computador; "Escolher imagem" no celular.
   - Feito em cima dos dados de hoje (tabela `docs`): não depende da migração.
   - Termos: fases agora se chamam claim, a caminho, com a GOM, envio liberado, enviado,
     recebido.
   - Testes: `npm test` e, no navegador com banco simulado, `npx playwright` em
     `scripts/e2e/mural.cjs` (30 checagens, desktop e celular).
   - **Mural v2 (24/11, depois do feedback "fraco e chato de mexer")**: busca; filtros por fase,
     membro e etiqueta (com contagem); **seleção em lote** (Selecionar, ou segurar um card;
     "Recebi" e "Mudar…" fase/CEG/etiqueta de vários de uma vez, com desfazer); **Quadro livre**
     (cards posicionados por ela com mouse ou dedo, arrastar vários selecionados juntos, zoom,
     notas soltas, "Arrumar por GOM"); posições e notas ficam em `mural/quadro`. No celular
     não depende de arrastar: segurar + "Mudar…". 5 abas cabem no celular.
   - Falta: testar com os dados e o Gemini de verdade; ligar o card ao catálogo no print
     (hoje o item nasce sem card, e "Ligar ao catálogo" faz isso depois); share target do
     WhatsApp (PWA); tela de GOM própria.
3. **Agora e pagamento** (pronto em 24/11/2026 no branch `claude/fork-agora-gom`, falta publicar):
   - Aba **Agora** (antes Início): fila de uma ação por vez, com "deixar pra depois". Ordem:
     cobrança vencida, cobrança que vence em até 7 dias, "envio liberado: pedir pra casa" por
     GOM (com os cards), "sem conferir há N dias" (CEG com planilha, 7 dias ou mais). Sem pix e
     sem caminho de comprovante; diz só em qual grupo olhar. "Paguei" usa `data-cst`/`setMany`
     (com desfazer).
   - **Baixa pelo comprovante**: "Paguei: mandar comprovante" aceita a imagem (PicPay), sobe como
     asset (igual `murFoto`), grava `comprovanteAsset` + `pagoProva` + `conferidoEm` e marca paga.
     Não lê valor por IA. Desfazer volta o status; o arquivo subido fica órfão no armazenamento.
   - **Tela da GOM** (folha `gomSheet`): ícone e nome da comunidade, nome da GOM, CEGs, o que
     está liberado, quanto devo, onde olhar e "montar envio" (reaproveita `envioItens`,
     só com os itens liberados daquela GOM). Abre pelo Mural, pela CEG e pela Agora.
   - **Regra da dona**: GOM nunca aparece sozinha. `gomTag(gom, comunidade)` é o único jeito de
     mostrar uma GOM (ícone + comunidade + GOM). O Mural agora agrupa por (GOM, comunidade).
   - Testes: `scripts/e2e/agora.cjs` (52 checagens, desktop e celular); `mural.cjs` ajustado
     ao cabeçalho novo. `banco-falso.js` aceita `window.__seedExtra` pra somar dados de teste.
   - Desfazer o comprovante apaga o arquivo subido; "montar envio" só cria o envio ao confirmar (desfazer apaga).
   - Falta: ler o valor do comprovante (decidido adiar); conferir tudo com o banco e os assets reais.
4. **Binder, faltantes e caça de fotos.**
5. **Rodada assistida.**

## App novo do zero (01/11/2026)

O `index.html` agora é um app novo, feito do zero. O antigo está em `/antigo.html`, e `/novo.html` só redireciona para `/`.

- **Ideia central:** o card do catálogo é a unidade de tudo. A situação dele (quero, esperando a CEG, a caminho, no Brasil, liberado, vindo pra mim, comigo) vem do status do pedido. Toda compra nova já nasce ligada ao card.
- **Abas:** Início (o que precisa de você), Coleção (grade de fotos com o filtro "onde está"), Contas (por prazo ou por comunidade, e o "a confirmar" fora da soma) e CEGs (por comunidade, com foto do grupo e barra de etapas).
- **O que grava,** sempre com "desfazer":
  - Paguei, Voltar pra pagar e Valor certo.
  - Paguei tudo da CEG, com 2 toques.
  - Pedi o envio e Recebi, mudando junto os itens da comunidade.
  - Ligar pedido ao catálogo e Criar card.
  - Nova compra: cria os pedidos e a conta "Item".
- **Trazido do antigo em 01/11:** sugestões do robô, edição e exclusão de qualquer registro, cadastros de comunidades, repasses, envios e CEGs. O antigo fica só como reserva.
- **Fotos de grupo:** vieram do WhatsApp Web pela busca, 64 de 67, salvas em `fotos` como `icon-grp-<hash>`.

### Visual "O encarte do álbum" (02/11/2026): concluído

Escolhido pela dona entre 4 prévias (`.impeccable/sketches/previas.html`, fora do Git). Feito pelo fluxo do `/impeccable`: DESIGN.md, revisão (22/40), polish, prévias, construção e revisão final com correções. Está no ar no commit `5678386`, conferido no computador, no celular e no escuro.
- Regra dela: nada de termos de encarte de álbum nos textos. No máximo o nome da era na Coleção.
- DESIGN.md descreve este visual. A ficha da direção fica em `.impeccable/surfaces/index-html.md` (fora do Git).
- O "Devo agora" só soma o que é certo. "A confirmar" e "sem valor" aparecem à parte.

O resumo de tudo o que foi feito fica em [HISTORICO.md](HISTORICO.md).

### Próximos passos (em ordem)
1. **Usar uns dias e testar a gravação de verdade.** Nenhum botão que grava foi clicado nos testes: Paguei, Pedi o envio, Recebi, Nova compra, Ligar ao catálogo, aceitar sugestão do robô, editar e apagar. Se algo der errado, usar "desfazer" e anotar.
2. **Cobranças que faltam:** ler as mensagens dos grupos de CEG desde setembro e mandar o que achar como sugestão do robô (ver o backlog abaixo).
3. **Fotos dos cards borradas:** as folhas do catálogo são pequenas (10x10). Buscar imagens maiores para os cards da coleção dela.
4. **Contas:** busca e filtro por comunidade.
5. **CEGs sem grupo cadastrado** (MANIAC 4, Jojo Martie e Aninha 3, paboracha 2, Han'Minnie 1, HeyDay 1): preencher o campo "Grupo" para ganharem foto.
6. **Um momento de animação** no visual do encarte (por exemplo, a entrada do valor devido). Opcional.
7. **Aposentar `/antigo.html`** quando o app novo estiver confiável.
8. **Login do Git expira com frequência:** o push às vezes pede login no terminal (`git push origin main`).

## Pendências abertas (30/10/2026)
Nomes e valores ficam no app (Cobranças, filtro "A confirmar"), nunca aqui.
- Taxa RF que venceu em 20/10 e cujos itens a GOM disse ter repassado: conferir
  com a GOM se foi paga.
- "Set 20" de uma comunidade: valor e item estavam numa imagem; ler no app da GOM.
- Fretes de duas caixas que venciam em 26/10: marcar como paga ou pendente.
- Multa da HeyDay sem valor e taxa de atraso da MANIAC: preencher o valor.
- Um repasse "karma regular" que talvez já tenha sido pago em 26/09: confirmar.
- 5 números de repasses antigos (Notion "claims perdidas por aí"): a combinação
  foi no privado e não aparece no WhatsApp Web; só perguntando a quem vendeu.
- Cinco comunidades de CEG novas foram lidas (sem mensagens dela), mas o roteiro
  ainda cita só as 20 primeiras.
- Do plano: relatório de cobertura, casos de teste, reforma de Cobranças.
- Backlog (01/11/2026), pedido e adiado:
  - Ler as mensagens dos grupos de CEG desde setembro e procurar cobranças que
    faltam no app. Mandar o que achar como sugestão do robô; nada entra direto.
    Reaproveitar `docs/roteiro-whatsapp.md` e `scripts/filtrar-whatsapp.mjs`.
  - Deixar o campo "grupo" das CEGs com o nome exatamente igual ao do WhatsApp.
    Ao renomear, mover a foto, porque a chave `icon-grp-<hash>` vem do nome.
  - Procurar, em todas as conversas desde setembro, grupos de CEG que estão fora
    da lista "cegs" do WhatsApp. Só listar; ela decide se entram na lista.
  - Fotos de grupo que faltam: HYUNLIX (Vicky e Bibi) e Drop collection (Nana).

## Pontos em aberto
- Plano Hobby da Vercel: no máximo 2 crons, por isso tudo que é diário entra no
  mesmo cron.
- `paboracha.com.br` não tem página pública por perfil, só a API. O link de
  pagamento aponta pra página inicial.

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
- **Coleção** continua igual. CEGs, Comunidades e Repasses viraram "Cadastros", links dentro de Pedidos.
- As telas Devo, Cobranças, Envios e Itens antigas saíram (continuam no histórico do Git). Abas antigas salvas no navegador caem em Hoje ou Pedidos.
- Código novo com prefixo `n-` (canhoto, linha, comunidade). Restos antigos no arquivo, sem uso: `cobBoard`, `envBoard`, `renderList` de cobranças, envios e itens, e CSS antigo.

Falta ou ficou parcial:
- Peso na Coleção: ainda carrega ~11 MB de folhas de sprites (as capas das eras no topo usam ~18 folhas). Hoje, Devo e Cobranças carregam quase nada. Ideia: capas de era menores ou sob demanda.
- O desfazer grava dados dela, então só foi conferido pela sintaxe, não clicado ao vivo.
- CSS ainda tem camadas antigas empilhadas; o bloco "etapa 5" no fim do `<style>` manda. Limpar as camadas velhas é uma etapa à parte.
- Alvos de toque ainda pequenos na Coleção (botão "info" dos cards, mitigado com área de clique maior).
- Não conferi o escuro em Itens e Coleção, nem a faixa de contraste de todos os chips de comunidade (cores por comunidade).

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

## Pontos em aberto
- Plano Hobby da Vercel: no máximo 2 crons, por isso tudo que é diário entra no
  mesmo cron.
- `paboracha.com.br` não tem página pública por perfil, só a API. O link de
  pagamento aponta pra página inicial.

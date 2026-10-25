# Plano do staycollection

Leia isto no começo de cada chat novo. O README explica como cada parte funciona;
este arquivo diz **o que já está pronto e o que vem depois**.

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
- Leitura com o Claude num lugar só (`scripts/ler-core.mjs`), usada pelo bot e
  pelo `ler.html`.

## Próximos passos (em ordem)
1. **Conferir a 1ª rodada do paboracha.** As 5 cobranças em aberto devem aparecer
   como "cobrança nova" ou "é a mesma?". Ver se ficou certo e ajustar a ligação
   automática se errou.
2. **Histórico do WhatsApp.** Ela manda os .txt pro bot. Conferir se as sugestões
   fazem sentido e ajustar o filtro (`encolher` em `api/telegram.js`) se o robô
   deixar coisa de fora.
3. **Relatório de cobertura** (plano de verificação). Uma tela ou relatório que
   mostre, pra cada fonte:
   - planilhas: quantas abas o robô leu e em quais achou o nome dela;
   - paboracha: se está tudo ligado;
   - planilhas onde o nome não aparece (ex.: "Han SG japonês 2026").
   
   Também comparar as fontes entre si: cobrança que existe numa e falta na
   outra, ou com valor diferente, vira alerta.
4. **Casos de teste.** Guardar exemplos de erros reais e conferir que continuam
   certos a cada mudança: planilha com várias abas, "9,45" lido como 945, robô
   apagando edição dela.
5. **Reforma da tela de Cobranças.** Ela pediu pra lembrar: a reforma nunca foi
   publicada.
6. **Catálogo** (quando ela quiser):
   - um catálogo só, juntando várias fontes;
   - preferir a melhor informação e a foto de maior resolução;
   - guardar só links das fotos, nunca cópias;
   - Bibliocards;
   - Bias Room só pelo Chrome dela, pra nomes e versões.
   
   Fontes mapeadas em `docs/fontes-catalogo.md`.

## Pontos em aberto
- Plano Hobby da Vercel: no máximo 2 crons, por isso tudo que é diário entra no
  mesmo cron.
- `paboracha.com.br` não tem página pública por perfil, só a API. O link de
  pagamento aponta pra página inicial.

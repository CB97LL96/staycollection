# Roteiro: ler os grupos do WhatsApp pelo navegador

Passo 3 na versão nova (ver `docs/PLANO.md`). Feito para uma conversa do
Claude Desktop **no computador dela**, com o Chrome aberto, o WhatsApp Web
logado e o app (staycollection.vercel.app) logado. Daqui da nuvem não dá.

## 0. Regras que valem o tempo todo
- Nada dos grupos vai para o git (repositório público). Arquivo de trabalho
  só em `_whatsapp/` (já está no `.gitignore`).
- Nada muda direto no app: tudo vira sugestão na aba "O que devo", e ela
  aceita ou descarta.
- Toda sugestão leva o trecho literal da mensagem (vira a `prova`).
- Só ler. Não mandar mensagem, não reagir, não marcar como lida de propósito
  em grupo nenhum.

## 1. Fazer a lista do que está confuso (antes de abrir o WhatsApp)
No app, levantar os registros em que a base ainda tem dúvida:

| aba | conta como confuso |
|---|---|
| Cobranças | status "A confirmar"; ou sem "conferido em"; ou sem prova |
| Itens | status "A confirmar"; ou "Item pago?" = "A confirmar" |
| Envios | status "A confirmar" |
| Repasses | pago = "A confirmar" |

Para cada um, anotar em `_whatsapp/_confusos.md`: comunidade, CEG, do que
se trata, valor que está na base e qual é a dúvida. É essa lista que diz em
quais grupos vale voltar antes de 11/10.

Todo o resto a base já tem certeza: não precisa voltar antes de 11/10 por
causa dele.

## 2. Quais grupos ler
- Só grupos que **pertencem a uma comunidade** (aparecem dentro de uma
  comunidade no WhatsApp). Grupo solto e conversa individual ficam de fora.
- Fazer a lista de comunidades e grupos e mostrar para ela antes de começar,
  com quantos grupos são. Ela pode tirar algum.

## 3. Até quando voltar
- **Todos os grupos da lista:** de 11/10/2026 até hoje.
- **Grupos ligados a um item de `_confusos.md`** (mesma comunidade ou CEG):
  continuar voltando até achar a mensagem que resolve a dúvida, ou até onde
  o WhatsApp Web deixar carregar. Anotar até que data chegou.

## 4. O que procurar em cada grupo
Igual ao filtro do bot (`encolher` em `api/telegram.js` e
`scripts/filtrar-whatsapp.mjs`):
- mensagem que cita um dos nomes dela (variável `MEUS_NOMES` na Vercel; ela
  diz quais são) e a mensagem antes e depois;
- aviso geral com valor em R$, pix, prazo, frete, taxa, multa,
  armazenamento, liberação, fechamento, comprovante;
- planilha ou link de cobrança postado no grupo (anotar o link).

Cuidado com número: "9,45" é nove reais e quarenta e cinco, não 945.

## 5. Como guardar o que achou
Para cada grupo, salvar um `.txt` em `_whatsapp/` no formato do export do
WhatsApp (uma linha por mensagem):

```
12/10/2026 14:05 - Nome: texto da mensagem
```

Nome do arquivo: `Conversa do WhatsApp com NOME DO GRUPO.txt`. Só as
mensagens que entraram pelo item 4, não o grupo inteiro.

## 6. Levar para o app
Mandar cada `.txt` para o bot do Telegram (pelo Telegram Web no mesmo
navegador, ou ela manda pelo celular). O bot lê, e as sugestões aparecem em
"O que devo" com a citação. É o mesmo caminho do passo 2.

## 7. Fechar a rodada
Mostrar para ela, curto:
- quantos grupos leu e até que data voltou em cada um;
- para cada item de `_confusos.md`: resolvido (com o trecho), ainda confuso,
  ou não achado;
- cobrança que apareceu no grupo e não existe no app, ou com valor diferente
  (isso já é o começo do relatório de cobertura).

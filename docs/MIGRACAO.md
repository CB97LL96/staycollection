# Mudar o STAY collection para o modelo novo (v2)

Roteiro para a dona. Tudo aqui é reversível: o modelo antigo (a tabela `docs`) **não é apagado nem mexido** em nenhum passo, e o app só passa a usar o novo no passo 6.

**Tempo:** uns 30 a 40 minutos, quase todos esperando conferir. Os comandos em si levam segundos (ou 1 a 2 minutos se você tiver milhares de registros).

## O que NÃO pode acontecer durante a migração

- **Não edite no app nem mande mensagem pro bot do Telegram entre o passo 3 e o passo 6.** O app antigo continua gravando em `docs`; o novo não fica sabendo. Se você mexer no meio, rode o passo 4 de novo antes do 6: ele traz o que é *novo*, mas **não traz edições em registros que já foram migrados**.
- **Não use os dois modelos ao mesmo tempo** (um celular com o app aberto na versão antiga depois do passo 6). Depois de ligar, feche o app antigo e abra de novo.
- **Não cole a chave `service_role` no chat.** Ela é a chave-mestra do banco. Quem pede é o formulário seguro da sessão principal.
- **Não rode o passo 4 (`--apply`) sem ter lido o relatório do passo 3.**

## O que muda para você no app

| Antes | Depois (v2) |
|---|---|
| CEG, comunidade e GOM ligadas pelo **nome** (renomear quebrava) | ligadas por **id**: renomear a CEG não solta os itens |
| GOM era só um texto | GOM é um nível próprio, com o ícone e o nome da comunidade |
| Pix e caminho de comprovante guardados | **o app não guarda mais**: só "onde olhar" (o grupo). O botão "copiar pix" some. O comprovante do PicPay que você anexa continua, como prova da cobrança |
| Campos que você editou podiam ser mudados pelo robô | campo em `travado` **nunca** é mudado pelo robô (ele só sugere) |

O pix que já está no modelo antigo **continua lá** (só no `docs`). Se você voltar ao antigo, ele reaparece.

## Passo a passo

### 1. Criar as tabelas novas (uma vez)

1. Abra o editor de SQL do projeto: <https://supabase.com/dashboard/project/rcdreaphagooklgcjsuc/sql/new>
2. Abra o arquivo [`supabase/v2.sql`](../supabase/v2.sql) no GitHub, copie **tudo** e cole no editor.
3. Clique em **Run**. Tem que aparecer *Success*. Pode rodar de novo sem problema.

Isso cria as tabelas ao lado das antigas (`docs` fica quieta) e liga o tempo real nelas.

### 2. Dar a chave para a sessão principal (pelo formulário seguro)

A sessão principal vai pedir, num **formulário seguro** (não no chat):

- **service_role**: <https://supabase.com/dashboard/project/rcdreaphagooklgcjsuc/settings/api> (seção *Project API keys*, a chave marcada `service_role`, "secret").
- **OWNER_ID** (código da sua conta): <https://supabase.com/dashboard/project/rcdreaphagooklgcjsuc/auth/users> → sua linha → **User UID**.

Esses dois valores já existem na Vercel (`SUPABASE_SERVICE_ROLE_KEY` e `OWNER_ID`); é o mesmo.

### 3. Relatório, sem gravar nada

Peça à sessão principal: **"rode `npm run migrar-v2` (só o relatório)"**. Ele mostra:

- quantos registros vão para cada tabela nova e quantos já existem lá;
- **CEGs e comunidades citadas sem cadastro**: por padrão elas **não** viram cadastro (o nome fica no registro, igual hoje). Se você quiser que virem, peça `npm run migrar-v2 -- --criar-por-citacao`;
- **CEGs com o mesmo nome em mais de uma comunidade** (confira);
- **valores que não deu pra ler** (ex.: um valor escrito de um jeito esquisito);
- quantos registros tinham pix (eles não vão para o novo).

Leia. Se algo estiver estranho, pare aqui e conte para a sessão principal.

### 4. Gravar

Peça: **"rode `npm run migrar-v2 -- --apply`"**. Rodar de novo é seguro: o que já existe no novo é ignorado, nunca sobrescrito.

### 5. Verificar (é aqui que a gente descobre se perdeu algo)

Peça: **"rode `npm run verificar-v2`"**. Ele compara o antigo com o novo e **falha** se divergir:

- contagem de registros de cada coleção;
- **total devido**, **total pago** e repasses a receber, centavo por centavo;
- itens por CEG;
- fotos e comprovantes;
- o conteúdo de cada registro (sem o pix).

Tem que terminar com **TUDO IGUAL**. Se não:

> **Se a verificação falhar:** copie as linhas `FALHA` e mande para a sessão principal. Não ligue o v2. O antigo segue valendo e nada foi perdido.

### 6. Ligar o v2

Só depois do "TUDO IGUAL", e **sem ter editado nada no app desde o passo 3**:

1. **Vercel** → o projeto → *Settings → Environment Variables* → crie `DATA_MODEL` = `v2`: <https://vercel.com/dashboard> (isso faz o bot do Telegram, o "compartilhar" do WhatsApp e as conferências diárias lerem e gravarem no novo).
2. A sessão principal troca `dataModel: "docs"` por `dataModel: "v2"` em `config.js` e publica (é isso que faz o **app** usar o novo).
3. **Redeploy** na Vercel (aba *Deployments* → os três pontinhos → *Redeploy*), para a variável valer.
4. Feche o app em todos os aparelhos e abra de novo. Confira o **Agora** (quanto você deve), o **Mural** e a **Coleção**.

### 7. Como voltar ao modelo antigo

O antigo nunca foi apagado. Para voltar **levando o que você fez no v2** (cobranças novas, status mudados...):

1. Peça à sessão principal: `npm run voltar-v2` (mostra o que mudaria) e depois `npm run voltar-v2 -- --apply`. O pix que estava no antigo é mantido. Se você apagou registros no v2 e quer apagar também no antigo, acrescente `--apagar`.
2. Troque `dataModel` de volta para `"docs"` em `config.js` e publique.
3. Na Vercel, mude `DATA_MODEL` para `docs` (ou apague a variável) e faça *Redeploy*.

Para voltar **descartando** o que fez no v2 (por exemplo, se ligou e não gostou no mesmo dia): pule o passo 1.

## Se algo der errado no meio

| Sintoma | O que fazer |
|---|---|
| O SQL deu erro | Mande a mensagem de erro; nada foi alterado em `docs` |
| O relatório trouxe números estranhos | Pare. Nada foi gravado |
| `--apply` parou no meio | Rode de novo: continua de onde parou, sem duplicar |
| O app abre vazio depois de ligar | Troque `dataModel` para `"docs"` e publique: volta na hora |
| Bot do Telegram respondeu "não achei" | Confira `DATA_MODEL` na Vercel e se fez Redeploy |

## O que existe em cada modelo (inventário)

| No app (coleção) | Tabela no v2 |
|---|---|
| `comunidades` | `comunidades` + `goms` |
| `cegs` | `cegs` |
| `itens` (a linha da GOM + os cards) | `claims` + `itens` (uma linha por card) |
| `acervo` | `itens` (origem `acervo`) |
| `cobrancas` | `cobrancas` (direção `pagar`) |
| `repasses` | `cobrancas` (direção `receber`) |
| `envios` | `envios` |
| `gruposwa` | `grupos_wa` |
| `caixa` (sugestões do robô) | `sugestoes` |
| `quadros` (Mural, rascunhos, notas) | `quadros` |
| `binder/meta` (metas, trocas, cópias contadas) | `binder_meta` |
| `colecao/*` (estado de cada card) | `posse` |
| `cardsnovos` | `cards_novos` |
| `fotos` (e comprovantes) | `card_fotos`, `itens.foto` e `provas` |
| `meta/fontes` | `meta` |
| qualquer outra (`mural`, `notas`, `apelidos` do app antigo...) | `avulsos` (rede de segurança: nada fica pra trás) |

O catálogo (`catalogo_itens`, `catalogo_eventos`, `catalogo_loja`) já era separado e não muda.

-- staycollection v2: o modelo novo (proposta "staycollection 2").
-- Rodar uma vez no SQL Editor do Supabase, DEPOIS do schema.sql.
-- Não mexe na tabela "docs": o app atual continua funcionando igual. As
-- tabelas novas ficam ao lado, até o app novo substituir o antigo.
--
-- Ideias que este modelo segue:
-- * ligações por id, não por nome (renomear CEG não quebra nada);
-- * GOM é um nível próprio (comunidade > GOM > CEG);
-- * "claim" é a linha como a GOM escreveu ("caixa 2 PHP", "26 e 27"), e ela
--   aponta para um ou vários itens (a sua cópia de cada card);
-- * o app não guarda pix nem caminho de comprovante: só "onde olhar";
-- * toda tabela tem "travado": os campos que você editou à mão. O robô não
--   muda esses campos sozinho, só sugere;
-- * "legado" guarda o registro antigo (sem pix), pra nada se perder.
--
-- Pode rodar de novo sem problema (create ... if not exists).

-- ---------- campos comuns ----------
-- id text: os migrados usam o id antigo com prefixo (ex.: "ceg-abc123"),
-- os novos ganham um uuid. owner: dono do registro (RLS).

create table if not exists public.comunidades (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,               -- como aparece no WhatsApp
  apelido text,                     -- como você chama
  situacao text,                    -- Ativa, Saindo, Sair, Resolvida, Sem itens
  onde_olhar text,                  -- grupo de avisos/pagamento/envio
  sigla text,
  cor text,
  notas text,
  travado text[] not null default '{}',
  legado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.goms (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  comunidade_id text references public.comunidades (id) on delete set null,
  nome text not null,
  notas text,
  travado text[] not null default '{}',
  legado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.grupos_wa (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  comunidade_id text references public.comunidades (id) on delete set null,
  nome text not null,
  cat text,                         -- claim, comp, rep, env, out
  arquivado boolean not null default false,
  legado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cegs (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  comunidade_id text references public.comunidades (id) on delete set null,
  gom_id text references public.goms (id) on delete set null,
  nome text not null,
  grupo_wa text,                    -- nome do grupo da CEG no WhatsApp
  planilha text,                    -- link
  forms text,                       -- link
  origem text,                      -- KR, JP, CN...
  status text,                      -- Em andamento, Na proxy, Com a GOM no Brasil...
  conferido_em date,
  notas text,
  travado text[] not null default '{}',
  legado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- A linha da GOM: o texto exatamente como ela escreveu. Uma claim pode ser
-- um card ("Han Aladin"), vários ("caixa 2 PHP", "26 e 27") ou um merch.
create table if not exists public.claims (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ceg_id text references public.cegs (id) on delete set null,
  texto text not null,
  valor numeric,                    -- valor do item na claim, em reais
  linha_planilha jsonb,             -- {aba, linha, nome}: o robô guarda sozinho
  notas text,
  travado text[] not null default '{}',
  legado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- A sua cópia de um card (ou de um merch). Três cópias do mesmo card são
-- três linhas aqui com o mesmo card_id. "Repetido" é calculado: mais de uma
-- cópia do mesmo card_id que não esteja "fora".
create table if not exists public.itens (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text,                     -- catalogo_itens.i; vazio = fora do catálogo
  descricao text,                   -- nome quando não tem card_id (ou como veio)
  membro text,
  tipo text,                        -- POB, Álbum, Lucky draw, fankit, merch...
  era text,
  claim_id text references public.claims (id) on delete set null,
  ceg_id text references public.cegs (id) on delete set null,
  origem text not null default 'ceg', -- ceg, compra, troca, presente, acervo
  status text,                      -- os termos de sempre: Garantido, Na WH / proxy, Envio liberado, Recebido...
  foto text,                        -- id da foto enviada (bucket "fotos")
  onde_guardado text,               -- binder, página, bolso
  estado_fisico text,
  etiquetas text[] not null default '{}',
  notas text,
  travado text[] not null default '{}',
  legado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Histórico de status de cada item (quando mudou e por quê).
create table if not exists public.item_status (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id text not null references public.itens (id) on delete cascade,
  status text not null,
  em date not null default current_date,
  prova_id text,
  criado_em timestamptz not null default now()
);

-- Cobranças: a pagar (item, frete inter, taxa RF, frete nacional...) ou a
-- receber (repasse). Sem pix: só onde olhar.
create table if not exists public.cobrancas (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direcao text not null default 'pagar', -- pagar | receber
  comunidade_id text references public.comunidades (id) on delete set null,
  ceg_id text references public.cegs (id) on delete set null,
  pessoa text,                      -- em repasse: quem vai te pagar
  referente text,
  tipo text,                        -- Item, Frete internacional, Frete nacional, Taxa RF, Armazenamento, Multa, Repasse, Outro
  valor numeric,
  prazo date,
  prazo_nota text,
  status text,                      -- Pendente, A confirmar, Aguardando a GOM, Não liberado, Paga, Cancelada...
  onde_olhar text,
  aviso_em date,
  pago_em date,
  conferido_em date,
  pabo_id text,
  notas text,
  travado text[] not null default '{}',
  legado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cobranca_itens (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cobranca_id text not null references public.cobrancas (id) on delete cascade,
  item_id text not null references public.itens (id) on delete cascade,
  primary key (cobranca_id, item_id)
);

create table if not exists public.envios (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  comunidade_id text references public.comunidades (id) on delete set null,
  gom_id text references public.goms (id) on delete set null,
  tipo text,
  status text,
  prazo date,
  prazo_nota text,
  rastreio text,
  como_pedir text,
  onde_olhar text,
  notas text,
  travado text[] not null default '{}',
  legado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.envio_itens (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  envio_id text not null references public.envios (id) on delete cascade,
  item_id text not null references public.itens (id) on delete cascade,
  primary key (envio_id, item_id)
);

-- De onde veio cada informação: mensagem, linha de planilha, print, link,
-- comprovante do PicPay, forms respondido, chat com a GOM.
create table if not exists public.provas (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null,               -- mensagem, planilha, print, link, picpay, forms, chat_gom
  texto text,
  link text,
  arquivo text,                     -- id no bucket "fotos"
  em timestamptz,
  alvo text not null,               -- tabela: cobrancas, itens, claims...
  alvo_id text not null,
  criado_em timestamptz not null default now()
);

-- Apelidos que a GOM usa, aprendidos quando você confirma uma ligação.
-- Ex.: na CEG X, "26" = itens/cards tais.
create table if not exists public.apelidos (
  id text primary key default gen_random_uuid()::text,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ceg_id text references public.cegs (id) on delete cascade,
  texto text not null,
  card_ids text[] not null default '{}',
  criado_em timestamptz not null default now()
);

-- Foto escolhida por você pra um card do catálogo (vale pra todas as cópias).
create table if not exists public.card_fotos (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null,
  foto text not null,
  primary key (owner, card_id)
);

-- ---------- índices ----------
create index if not exists goms_comunidade on public.goms (comunidade_id);
create index if not exists cegs_comunidade on public.cegs (comunidade_id);
create index if not exists cegs_gom on public.cegs (gom_id);
create index if not exists claims_ceg on public.claims (ceg_id);
create index if not exists itens_ceg on public.itens (ceg_id);
create index if not exists itens_card on public.itens (card_id);
create index if not exists itens_claim on public.itens (claim_id);
create index if not exists item_status_item on public.item_status (item_id);
create index if not exists cobrancas_ceg on public.cobrancas (ceg_id);
create index if not exists provas_alvo on public.provas (alvo, alvo_id);

-- ---------- segurança e atualizado_em ----------
create or replace function public.v2_touch() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['comunidades','goms','grupos_wa','cegs','claims','itens','item_status',
    'cobrancas','cobranca_itens','envios','envio_itens','provas','apelidos','card_fotos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "do dono" on public.%I', t);
    execute format('create policy "do dono" on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
  foreach t in array array['comunidades','goms','grupos_wa','cegs','claims','itens','cobrancas','envios'] loop
    execute format('drop trigger if exists v2_touch on public.%I', t);
    execute format('create trigger v2_touch before update on public.%I for each row execute function public.v2_touch()', t);
  end loop;
end $$;

-- Coleção SKZ: banco no Supabase.
-- Rodar uma vez no SQL Editor do projeto (Supabase > SQL Editor > New query).
--
-- Primeira etapa da migração: cada registro do app fica como um documento
-- JSON, igual ao banco do artefato (coleção + id + dados). Assim o app
-- continua funcionando sem reescrever as telas. Dá pra normalizar depois.

create table if not exists public.docs (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, col, id)
);

alter table public.docs enable row level security;

-- Cada pessoa só vê e edita os próprios registros.
drop policy if exists "docs do dono" on public.docs;
create policy "docs do dono" on public.docs
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs
  for each row execute function public.docs_touch();

-- update() do app: junta os campos novos aos que já existem, sem apagar os
-- outros. Falha se o registro não existir (mesmo comportamento do artefato).
create or replace function public.doc_merge(p_col text, p_id text, p_patch jsonb)
returns void
language plpgsql security invoker as $$
begin
  update public.docs set data = data || p_patch
   where owner = auth.uid() and col = p_col and id = p_id;
  if not found then
    raise exception 'documento % / % não existe', p_col, p_id using errcode = 'P0002';
  end if;
end $$;

-- Atualização em tempo real: o app recebe as mudanças sem recarregar.
alter table public.docs replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs'
  ) then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

-- Fotos dos cards. O nome de cada arquivo é um código aleatório de 32
-- caracteres, então o link não dá pra adivinhar. Só quem está logado envia
-- ou apaga.
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists "fotos: enviar" on storage.objects;
create policy "fotos: enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos');

drop policy if exists "fotos: apagar as minhas" on storage.objects;
create policy "fotos: apagar as minhas" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and owner = auth.uid());

-- Catálogo de photocards (fonte: CraftenSKZ e outras). Diferente de "docs":
-- não é dado da usuária, é referência compartilhada. Só a chave service_role
-- (usada pelo cron do Vercel, nunca pelo navegador) escreve aqui; não existe
-- policy de insert/update/delete pra authenticated/anon de propósito — RLS
-- ligado sem nenhuma policy bloqueia todo mundo, exceto service_role, que
-- ignora RLS. O app lê o catálogo do colecao.json estático (rápido, servido
-- pela CDN), não desta tabela; ela só existe pra saber o que já foi
-- importado quando o cron confere a fonte de novo (scripts/sync-catalogo.mjs
-- e api/cron/sync-catalogo.js).
create table if not exists public.catalogo_itens (
  i text primary key,
  m text not null,
  e text not null,
  o text not null,
  t text not null,
  v text not null,
  s text,
  p jsonb,
  criado_em timestamptz not null default now()
);

alter table public.catalogo_itens enable row level security;

-- Linha do tempo de eventos (fanclube, pop-up, Season's Greetings, merch,
-- collab, turnê, revista etc.) importada da planilha "SKZ Era Timeline"
-- (mantida por terceiros, fora deste projeto). É em nível de evento/era, não
-- item a item como catalogo_itens — cobre as categorias que o CraftenSKZ não
-- tem. Mesma postura de acesso: só service_role escreve.
create table if not exists public.catalogo_eventos (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  tipo text,
  data_inicio date,
  data_inicio_raw text,
  data_fim date,
  data_fim_raw text,
  pais text,
  cidade text,
  notas text,
  aba_origem text not null,
  criado_em timestamptz not null default now()
);

alter table public.catalogo_eventos enable row level security;

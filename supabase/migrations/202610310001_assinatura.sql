create table if not exists public.planos (
  id text primary key,
  nome text not null,
  valor numeric(10, 2) not null check (valor > 0),
  ativo boolean not null default true
);

insert into public.planos (id, nome, valor, ativo)
values ('mensal', 'Caderninho de Fiado: assinatura mensal', 9.90, true)
on conflict (id) do nothing;

alter table public.planos enable row level security;
drop policy if exists "planos_leitura_publica" on public.planos;
create policy "planos_leitura_publica"
  on public.planos for select to anon, authenticated using (true);

revoke all on public.planos from anon, authenticated;
grant select on public.planos to anon, authenticated;
grant all on public.planos to service_role;

create table if not exists public.assinaturas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('pendente', 'ativa', 'pausada', 'cancelada')),
  valido_ate timestamptz,
  mp_preapproval_id text,
  atualizado_em timestamptz not null default now()
);

-- Quem ligou a proteção em 2 etapas só lê a assinatura depois do código (token aal2), como o Supabase recomenda.
create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors as f
      where f.user_id = auth.uid() and f.status = 'verified'
    );
$$;

revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

alter table public.assinaturas enable row level security;
drop policy if exists "assinaturas_leitura_propria" on public.assinaturas;
create policy "assinaturas_leitura_propria"
  on public.assinaturas for select to authenticated using (auth.uid() = user_id and public.mfa_ok());

revoke all on public.assinaturas from anon, authenticated;
grant select on public.assinaturas to authenticated;
grant all on public.assinaturas to service_role;

create or replace function public.minha_situacao()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with conta as (
    select u.created_at
    from auth.users as u
    where u.id = auth.uid() and public.mfa_ok()
  ),
  estado as (
    select a.status, a.valido_ate
    from public.assinaturas as a
    where a.user_id = auth.uid()
  ),
  plano as (
    select p.valor
    from public.planos as p
    where p.id = 'mensal' and p.ativo = true
  ),
  datas as (
    select
      pg_catalog.now() as agora,
      c.created_at + interval '3 days' as teste_ate,
      e.status as assinatura,
      e.valido_ate,
      greatest(
        c.created_at + interval '3 days',
        case e.status
          when 'ativa' then e.valido_ate + interval '3 days'
          when 'pausada' then e.valido_ate
          when 'cancelada' then e.valido_ate
          when 'pendente' then e.valido_ate -- pediu um link novo: os dias já pagos continuam valendo
          else null
        end
      ) as liberado_ate,
      p.valor as preco
    from conta as c
    left join estado as e on true
    left join plano as p on true -- plano desligado não pode trancar todo mundo
  )
  select pg_catalog.jsonb_build_object(
    'agora', d.agora,
    'teste_ate', d.teste_ate,
    'assinatura', d.assinatura,
    'valido_ate', d.valido_ate,
    'liberado_ate', d.liberado_ate,
    'preco', d.preco
  )
  from datas as d;
$$;

revoke all on function public.minha_situacao() from public, anon;
grant execute on function public.minha_situacao() to authenticated;

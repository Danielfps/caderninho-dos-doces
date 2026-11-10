-- Segunda revisão: somente acréscimos e substituição de funções, sem remover histórico.
alter table public.contratacoes add column if not exists cancelamento_pendente boolean not null default false;
alter table public.contratacoes add column if not exists checkout_operacao uuid;
alter table public.contratacoes add column if not exists checkout_reservado_ate timestamptz;
alter table public.contratacoes add column if not exists tentada_em timestamptz;
alter table public.contratacoes add column if not exists conferencia_falhou boolean not null default false;
alter table public.contratacoes add column if not exists reconciliar_apos timestamptz;
alter table public.cobrancas add column if not exists mp_assinatura_id text;
alter table public.cobrancas add column if not exists duplicada boolean not null default false;

create or replace function public.marcar_sincronizada(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  update public.contratacoes set sincronizada_em=now(),tentada_em=now(),conferencia_falhou=false,reconciliar_apos=null where id=p_id;
end;
$$;
create or replace function public.marcar_falha_sincronizacao(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  update public.contratacoes set tentada_em=now(),conferencia_falhou=true,reconciliar_apos=now()+interval '1 minute' where id=p_id;
end;
$$;
revoke all on function public.marcar_falha_sincronizacao(uuid) from public,anon,authenticated;
grant execute on function public.marcar_falha_sincronizacao(uuid) to service_role;

-- Validades são uma projeção dos pagamentos: recalcular sem apagar os registros financeiros.
create or replace function public.recalcular_validade(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_b record; v_teste timestamptz; v_max timestamptz; v_anterior timestamptz;
  v_inicio timestamptz; v_fim timestamptz; v_por_contrato jsonb:='{}'::jsonb;
begin
  -- Helper interno: EXECUTE revogado abaixo; também é usado pelo dono na migração e pelos gatilhos.
  if p_user is null then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
  select created_at+interval '3 days' into v_teste from auth.users where id=p_user;
  select max(valido_ate) into v_max from public.compras where user_id=p_user and status='aprovada';
  for v_b in select b.*,c.plano from public.cobrancas b join public.contratacoes c on c.id=b.contratacao_id
    where b.user_id=p_user and b.estado='aprovada'
    order by coalesce(b.debitada_em,b.criado_em),b.criado_em,b.mp_cobranca_id
  loop
    v_anterior:=(v_por_contrato->>v_b.contratacao_id::text)::timestamptz;
    if v_anterior is not null and coalesce(v_b.debitada_em,v_b.criado_em)-v_anterior<=interval '15 days' then
      v_inicio:=greatest(v_anterior,v_teste);
    else
      v_inicio:=greatest(coalesce(v_b.debitada_em,v_b.criado_em),v_teste,v_max);
    end if;
    v_fim:=v_inicio+case when v_b.plano='anual' then interval '12 months' else interval '1 month' end;
    update public.cobrancas set valido_de=v_inicio,valido_ate=v_fim
      where mp_cobranca_id=v_b.mp_cobranca_id and (valido_de,valido_ate) is distinct from (v_inicio,v_fim);
    v_por_contrato:=jsonb_set(v_por_contrato,array[v_b.contratacao_id::text],to_jsonb(v_fim));
    v_max:=greatest(v_max,v_fim);
  end loop;
end;
$$;

create or replace function public.recalcular_validade_apos_pagamento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalcular_validade(new.user_id);
  return new;
end;
$$;
create trigger cobrancas_recalcular_validade after insert or update of estado,debitada_em on public.cobrancas
  for each row execute function public.recalcular_validade_apos_pagamento();
create trigger compras_recalcular_validade after insert or update of status,valido_ate on public.compras
  for each row execute function public.recalcular_validade_apos_pagamento();
revoke all on function public.recalcular_validade(uuid),public.recalcular_validade_apos_pagamento() from public,anon,authenticated;
grant execute on function public.recalcular_validade(uuid) to service_role;

create or replace function public.solicitar_cancelamento(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  select user_id into v_user from public.contratacoes where id=p_id;
  if v_user is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0)); end if;
  update public.contratacoes set cancelamento_pendente=true,atualizado_em=now() where id=p_id;
end;
$$;

create or replace function public.concluir_cancelamento(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_estado text;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  select user_id into v_user from public.contratacoes where id=p_id;
  if v_user is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0)); end if;
  select case when c.mp_preapproval_id is null
    and not exists(select 1 from public.cobrancas b where b.contratacao_id=c.id)
    then 'abandonada' else 'cancelada' end into v_estado from public.contratacoes c where c.id=p_id for update;
  update public.contratacoes set cancelamento_pendente=false,estado=v_estado,
    cancelada_em=case when v_estado='cancelada' then coalesce(cancelada_em,now()) else cancelada_em end,
    atualizado_em=now() where id=p_id;
end;
$$;
revoke all on function public.solicitar_cancelamento(uuid),public.concluir_cancelamento(uuid) from public,anon,authenticated;
grant execute on function public.solicitar_cancelamento(uuid),public.concluir_cancelamento(uuid) to service_role;

-- Recursos conhecidos cuja resposta chegou: mesmo um trabalhador atrasado deixa seu plano rastreável.
create table if not exists public.estornos_pagamento (
  mp_pagamento_id text primary key,
  mp_status text not null check (mp_status in ('refunded','charged_back')),
  recebido_em timestamptz not null default now()
);
alter table public.estornos_pagamento enable row level security;
revoke all on public.estornos_pagamento from public,anon,authenticated;
grant all on public.estornos_pagamento to service_role;

create or replace function public.estornar_por_pagamento(p_pagamento text,p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer; v_user uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  if nullif(p_pagamento,'') is null or p_status not in ('refunded','charged_back') then raise exception 'parametros_invalidos'; end if;
  -- Mesma ordem em registrar_cobranca: pagamento, depois conta. Vale mesmo sem cobrança existente.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pagamento:'||p_pagamento,0));
  for v_user in select distinct user_id from public.cobrancas where mp_pagamento_id=p_pagamento and user_id is not null order by user_id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0));
  end loop;
  insert into public.estornos_pagamento(mp_pagamento_id,mp_status) values(p_pagamento,p_status) on conflict do nothing;
  update public.cobrancas set estado='estornada',mp_pagamento_status=p_status,atualizado_em=now()
    where mp_pagamento_id=p_pagamento and estado<>'estornada';
  get diagnostics v_n=row_count;
  return jsonb_build_object('estornadas',v_n);
end;
$$;

create table if not exists public.planos_checkout (
  mp_plano_id text primary key,
  contratacao_id uuid not null references public.contratacoes(id),
  fechado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table public.planos_checkout enable row level security;
revoke all on public.planos_checkout from public,anon,authenticated;
grant all on public.planos_checkout to service_role;

create or replace function public.marcar_plano_fechado(p_mp_plano_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  update public.planos_checkout set fechado_em=coalesce(fechado_em,now()) where mp_plano_id=p_mp_plano_id;
end;
$$;
create or replace function public.planos_checkout_pendentes(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(p)) from public.planos_checkout p join public.contratacoes c on c.id=p.contratacao_id
    where c.id=p_id and p.fechado_em is null and p.mp_plano_id is distinct from c.mp_plano_id),'[]'::jsonb);
end;
$$;
revoke all on function public.marcar_plano_fechado(text),public.planos_checkout_pendentes(uuid) from public,anon,authenticated;
grant execute on function public.marcar_plano_fechado(text),public.planos_checkout_pendentes(uuid) to service_role;

create or replace function public.registrar_cobranca_assinatura(
  p_mp_cobranca_id text,p_contratacao uuid,p_pagamento text,p_valor numeric,p_estado text,
  p_mp_status text,p_pag_status text,p_debitada timestamptz,p_assinatura text,p_duplicada boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.cobrancas%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  perform public.registrar_cobranca(p_mp_cobranca_id,p_contratacao,p_pagamento,p_valor,p_estado,p_mp_status,p_pag_status,p_debitada);
  -- O alerta financeiro sobrevive ao cancelamento da assinatura extra e às releituras.
  update public.cobrancas set mp_assinatura_id=p_assinatura,duplicada=duplicada or p_duplicada
    where mp_cobranca_id=p_mp_cobranca_id and contratacao_id=p_contratacao returning * into v_row;
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.registrar_cobranca_assinatura(text,uuid,text,numeric,text,text,text,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.registrar_cobranca_assinatura(text,uuid,text,numeric,text,text,text,timestamptz,text,boolean) to service_role;

create or replace function public.confirmar_checkout(p_id uuid,p_operacao uuid,p_mp_plano_id text,p_init_point text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_c public.contratacoes%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  select * into v_c from public.contratacoes where id=p_id;
  if v_c.user_id is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_c.user_id::text,0)); end if;
  insert into public.planos_checkout(mp_plano_id,contratacao_id) values(p_mp_plano_id,p_id) on conflict do nothing;
  update public.contratacoes set mp_plano_id=p_mp_plano_id,init_point=p_init_point,
    checkout_reservado_ate=null,checkout_operacao=null,atualizado_em=now()
    where id=p_id and estado='checkout_pendente' and not cancelamento_pendente
      and mp_plano_id is null and checkout_operacao=p_operacao and checkout_reservado_ate>now();
  return found;
end;
$$;

create or replace function public.liberar_checkout(p_id uuid,p_operacao uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  update public.contratacoes set checkout_reservado_ate=null,checkout_operacao=null where id=p_id and checkout_operacao=p_operacao;
end;
$$;
revoke all on function public.confirmar_checkout(uuid,uuid,text,text),public.liberar_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirmar_checkout(uuid,uuid,text,text),public.liberar_checkout(uuid,uuid) to service_role;

-- Uma só regra para cron, conferência do usuário e sinalização no app.
create or replace function public.contratacao_revisavel(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.contratacoes c where c.id=p_id and (
    c.estado<>'abandonada' or c.criado_em>=now()-interval '48 hours'
    or exists(select 1 from public.cobrancas b where b.contratacao_id=c.id)
  ));
$$;
revoke all on function public.contratacao_revisavel(uuid) from public,anon,authenticated;
grant execute on function public.contratacao_revisavel(uuid) to service_role;

create or replace function public.contratacoes_reconciliar(p_limite integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(e)-'prioridade' order by e.prioridade,
    coalesce(e.tentada_em,e.sincronizada_em,'-infinity'::timestamptz),e.criado_em,e.id)
    from (select c.*,case
      when c.cancelamento_pendente or c.conferencia_falhou then 0
      when c.estado in ('checkout_pendente','aguardando_pagamento','ativa','pausada','falha_pagamento') then 1
      else 2 end as prioridade from public.contratacoes c
    where public.contratacao_revisavel(c.id) and (c.reconciliar_apos is null or c.reconciliar_apos<=now()) and (
      c.cancelamento_pendente or c.conferencia_falhou or
      (c.estado in ('checkout_pendente','aguardando_pagamento','ativa','pausada','falha_pagamento') and
        (c.sincronizada_em is null or c.sincronizada_em<=now()-interval '6 hours'
          or c.proxima_cobranca<=now() or c.estado='aguardando_pagamento')) or
      (c.estado in ('cancelada','encerrada','abandonada') and (c.mp_plano_id is not null or c.mp_preapproval_id is not null
        or exists(select 1 from public.cobrancas b where b.contratacao_id=c.id))
        and (c.sincronizada_em is null or c.sincronizada_em<=now()-interval '24 hours')) or
      exists(select 1 from public.planos_checkout p where p.contratacao_id=c.id and p.fechado_em is null
        and p.mp_plano_id is distinct from c.mp_plano_id)
    ) order by prioridade,coalesce(c.tentada_em,c.sincronizada_em,'-infinity'::timestamptz),c.criado_em,c.id
    limit least(50,greatest(1,p_limite))) e),'[]'::jsonb);
end;
$$;

create or replace function public.contratacoes_para_usuario(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.criado_em,c.id) from public.contratacoes c where c.user_id=p_user
    and public.contratacao_revisavel(c.id)
    and (c.cancelamento_pendente or c.mp_plano_id is not null or c.mp_preapproval_id is not null
      or exists(select 1 from public.cobrancas b where b.contratacao_id=c.id)
      or c.estado in ('checkout_pendente','aguardando_pagamento','ativa','pausada','falha_pagamento')
      or exists(select 1 from public.planos_checkout p where p.contratacao_id=c.id and p.fechado_em is null))), '[]'::jsonb);
end;
$$;
create index if not exists contratacoes_tentativa_idx on public.contratacoes(reconciliar_apos,tentada_em);
revoke all on function public.contratacoes_reconciliar(integer),public.contratacoes_para_usuario(uuid) from public,anon,authenticated;
grant execute on function public.contratacoes_reconciliar(integer),public.contratacoes_para_usuario(uuid) to service_role;

create or replace function public.iniciar_contratacao(p_user uuid, p_plano text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_atual public.contratacoes%rowtype;
  v_tem boolean;
  v_valor numeric(10,2);
  v_recorrente numeric(10,2);
  v_promo numeric(10,2);
  v_meses integer;
  v_id uuid;
  v_tentativas integer;
  v_operacao uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  if p_user is null or p_plano not in ('mensal','anual') then raise exception 'parametros_invalidos'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));

  if exists(select 1 from public.contratacoes where user_id=p_user and cancelamento_pendente) then
    return jsonb_build_object('acao','em_andamento');
  end if;

  select c.* into v_atual from public.contratacoes c where c.user_id=p_user
    and c.estado in ('checkout_pendente','aguardando_pagamento','ativa','pausada','falha_pagamento')
    order by c.criado_em desc limit 1;
  v_tem:=found;
  if v_tem and v_atual.estado in ('ativa','aguardando_pagamento') then
    return jsonb_build_object('acao','ja_ativa','id',v_atual.id);
  end if;

  -- O preço vem sempre do banco. Mudou com tentativa aberta: a tentativa antiga é substituída abaixo.
  select p.valor,p.meses into v_recorrente,v_meses from public.planos p
    where p.id=case when p_plano='anual' then 'anual' else 'mensal' end and p.ativo;
  if v_recorrente is null then return jsonb_build_object('acao','plano_indisponivel'); end if;
  v_valor:=v_recorrente;
  if p_plano='mensal' and not exists(
    select 1 from public.cobrancas b join public.contratacoes c on c.id=b.contratacao_id
      where c.user_id=p_user and c.plano='mensal' and b.estado='aprovada'
    union all
    select 1 from public.compras x where x.user_id=p_user and x.plano='mensal' and x.status='aprovada'
  ) then
    select p.valor into v_promo from public.planos p where p.id='mensal_promo' and p.ativo;
    if v_promo is not null and v_promo<v_recorrente then v_valor:=v_promo; end if;
  end if;

  if v_tem then
    if v_atual.estado='checkout_pendente' and v_atual.expira_em>now() and v_atual.plano=p_plano
      and v_atual.valor_inicial=v_valor and v_atual.valor_recorrente=v_recorrente then
      if v_atual.init_point is not null then return jsonb_build_object('acao','reusar','id',v_atual.id,'init_point',v_atual.init_point); end if;
      if v_atual.criado_em>now()-interval '20 seconds' or v_atual.checkout_reservado_ate>now() then
        return jsonb_build_object('acao','em_andamento','id',v_atual.id);
      end if;
      v_operacao:=gen_random_uuid();
      update public.contratacoes set checkout_operacao=v_operacao,checkout_reservado_ate=now()+interval '60 seconds' where id=v_atual.id;
      return jsonb_build_object('acao','retomar','id',v_atual.id,'plano',v_atual.plano,
        'valor_inicial',v_atual.valor_inicial,'valor_recorrente',v_atual.valor_recorrente,'moeda',v_atual.moeda,'operacao',v_operacao);
    end if;
    return jsonb_build_object('acao','substituir','id',v_atual.id,'mp_plano_id',v_atual.mp_plano_id,
      'mp_preapproval_id',v_atual.mp_preapproval_id);
  end if;

  select count(*) into v_tentativas from public.contratacoes c where c.user_id=p_user and c.criado_em>now()-interval '1 hour';
  if v_tentativas>=10 then return jsonb_build_object('acao','limite'); end if;

  v_operacao:=gen_random_uuid();
  insert into public.contratacoes(user_id,plano,valor_inicial,valor_recorrente,moeda,estado,expira_em,checkout_operacao,checkout_reservado_ate)
    values(p_user,p_plano,v_valor,v_recorrente,'BRL','checkout_pendente',now()+interval '24 hours',v_operacao,now()+interval '60 seconds') returning id into v_id;
  return jsonb_build_object('acao','criar','id',v_id,'plano',p_plano,'valor_inicial',v_valor,
    'valor_recorrente',v_recorrente,'moeda','BRL','meses',coalesce(v_meses,1),'operacao',v_operacao);
end;
$$;


create or replace function public.registrar_cobranca(
  p_mp_cobranca_id text,p_contratacao uuid,p_pagamento text,p_valor numeric,p_estado text,
  p_mp_status text,p_pag_status text,p_debitada timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_c public.contratacoes%rowtype;
  v_old public.cobrancas%rowtype;
  v_row public.cobrancas%rowtype;
  v_existe boolean;
  v_valido_de timestamptz;
  v_valido_ate timestamptz;
  v_duracao interval;
  v_teste timestamptz;
  v_debitada timestamptz;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  if nullif(p_mp_cobranca_id,'') is null or p_contratacao is null or p_valor is null or p_valor<0
    or p_estado not in ('pendente','aprovada','recusada','estornada') then raise exception 'parametros_invalidos'; end if;
  if p_pagamento is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pagamento:'||p_pagamento,0));
    if p_estado='estornada' then
      insert into public.estornos_pagamento(mp_pagamento_id,mp_status) values(p_pagamento,
        case when p_pag_status='charged_back' then 'charged_back' else 'refunded' end) on conflict do nothing;
    end if;
    if exists(select 1 from public.estornos_pagamento where mp_pagamento_id=p_pagamento) then p_estado:='estornada'; end if;
  end if;
  select user_id into v_user from public.contratacoes where id=p_contratacao;
  if not found then raise exception 'contratacao_nao_encontrada'; end if;
  -- Mesma trava de iniciar_contratacao: a validade olha todas as cobranças da conta.
  if v_user is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0)); end if;
  select * into v_c from public.contratacoes where id=p_contratacao for update;
  select * into v_old from public.cobrancas where mp_cobranca_id=p_mp_cobranca_id for update;
  v_existe:=found;
  v_debitada:=coalesce(p_debitada,v_old.debitada_em,now());

  if v_existe then
    -- Repetir a leitura nunca soma dias nem desfaz uma aprovação. Estorno é final.
    if v_old.estado='estornada' or (v_old.estado='aprovada' and p_estado<>'estornada') then return to_jsonb(v_old); end if;
    if p_estado<>'aprovada' then
      update public.cobrancas set estado=p_estado,mp_status=coalesce(p_mp_status,''),mp_pagamento_status=p_pag_status,
        mp_pagamento_id=coalesce(p_pagamento,mp_pagamento_id),debitada_em=v_debitada,atualizado_em=now()
        where mp_cobranca_id=p_mp_cobranca_id returning * into v_row;
      return to_jsonb(v_row);
    end if;
  end if;

  if p_estado='aprovada' then
    select u.created_at+interval '3 days' into v_teste from auth.users u where u.id=v_c.user_id;
    select max(b.valido_ate) into v_valido_de from public.cobrancas b
      where b.contratacao_id=p_contratacao and b.estado='aprovada';
    if v_valido_de is not null and v_debitada-v_valido_de<=interval '15 days' then
      v_valido_de:=greatest(v_valido_de,coalesce(v_teste,v_valido_de));
    else
      select greatest(v_debitada,coalesce(v_teste,v_debitada),
        coalesce((select max(b.valido_ate) from public.cobrancas b where b.user_id=v_c.user_id and b.estado='aprovada'),v_debitada),
        coalesce((select max(x.valido_ate) from public.compras x where x.user_id=v_c.user_id and x.status='aprovada'),v_debitada))
        into v_valido_de;
    end if;
    v_duracao:=case when v_c.plano='anual' then interval '12 months' else interval '1 month' end;
    v_valido_ate:=v_valido_de+v_duracao;
  end if;

  insert into public.cobrancas(mp_cobranca_id,contratacao_id,user_id,mp_pagamento_id,valor,estado,mp_status,mp_pagamento_status,debitada_em,valido_de,valido_ate)
    values(p_mp_cobranca_id,p_contratacao,v_c.user_id,p_pagamento,p_valor,p_estado,coalesce(p_mp_status,''),p_pag_status,v_debitada,v_valido_de,v_valido_ate)
    on conflict(mp_cobranca_id) do update set mp_pagamento_id=excluded.mp_pagamento_id,valor=excluded.valor,
      estado=excluded.estado,mp_status=excluded.mp_status,mp_pagamento_status=excluded.mp_pagamento_status,
      debitada_em=excluded.debitada_em,valido_de=excluded.valido_de,valido_ate=excluded.valido_ate,atualizado_em=now()
    returning * into v_row;
  -- AFTER trigger pode ter recalculado o período, inclusive de uma aprovação fora de ordem.
  select * into v_row from public.cobrancas where mp_cobranca_id=p_mp_cobranca_id;
  return to_jsonb(v_row);
end;
$$;


create or replace function public.aplicar_preapproval(p_id uuid,p_mp_id text,p_status text,p_ultima_mudanca timestamptz,p_proxima timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes%rowtype;
  v_novo text;
  v_ultima text;
  v_user uuid;
  v_status text:=lower(coalesce(p_status,''));
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  select user_id into v_user from public.contratacoes where id=p_id;
  if not found then raise exception 'contratacao_nao_encontrada'; end if;
  if v_user is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0)); end if;
  select * into v_c from public.contratacoes where id=p_id for update;
  if v_c.mp_preapproval_id is not null and p_mp_id is not null and v_c.mp_preapproval_id<>p_mp_id then
    return jsonb_build_object('estado',v_c.estado,'duplicada',true,'cancelar_no_mp',true);
  end if;
  -- Estados finais e leitura mais velha não mudam o estado. O servidor marca sucesso ao terminar tudo.
  if v_c.estado in ('cancelada','encerrada')
    or (v_c.mp_atualizado_em is not null and p_ultima_mudanca is not null and p_ultima_mudanca<v_c.mp_atualizado_em) then
    return jsonb_build_object('estado',v_c.estado,'duplicada',false,'cancelar_no_mp',false);
  end if;

  v_novo:=case v_status
    when 'authorized' then 'aguardando_pagamento'
    when 'paused' then 'pausada'
    when 'cancelled' then 'cancelada'
    when 'canceled' then 'cancelada'
    when 'finished' then 'encerrada'
    when 'expired' then 'encerrada'
    when 'pending' then 'checkout_pendente'
    else v_c.estado end;

  if v_novo='aguardando_pagamento' then
    -- Fatura agendada para o futuro não conta: vale o último resultado real de cobrança.
    select b.estado into v_ultima from public.cobrancas b
      where b.contratacao_id=v_c.id and b.estado in ('aprovada','recusada')
      order by b.debitada_em desc nulls last,b.criado_em desc limit 1;
    if v_ultima='aprovada' then v_novo:='ativa';
    elsif v_ultima='recusada' then v_novo:='falha_pagamento'; end if;
  elsif v_novo='checkout_pendente' and v_c.estado<>'abandonada' then
    v_novo:=v_c.estado;
  end if;

  -- A pessoa concluiu um link que tínhamos dado por abandonado.
  if v_c.estado='abandonada' then
    if v_novo='checkout_pendente' then
      v_novo:='abandonada';
    elsif v_novo in ('aguardando_pagamento','ativa','falha_pagamento','pausada') then
      if exists(select 1 from public.contratacoes x where x.user_id=v_c.user_id and x.id<>v_c.id
        and x.estado in ('ativa','falha_pagamento','aguardando_pagamento','pausada')) then
        return jsonb_build_object('estado','abandonada','duplicada',true,'cancelar_no_mp',true);
      end if;
      update public.contratacoes set estado='abandonada',atualizado_em=now()
        where user_id=v_c.user_id and id<>v_c.id and estado='checkout_pendente';
    end if;
  end if;

  update public.contratacoes set estado=v_novo,mp_preapproval_id=coalesce(p_mp_id,mp_preapproval_id),
    mp_status=v_status,mp_atualizado_em=coalesce(p_ultima_mudanca,mp_atualizado_em),proxima_cobranca=p_proxima,
    autorizada_em=case when v_status='authorized' then coalesce(autorizada_em,now()) else autorizada_em end,
    cancelada_em=case when v_novo='cancelada' then coalesce(cancelada_em,now()) else cancelada_em end,
    atualizado_em=now() where id=p_id returning * into v_c;
  return jsonb_build_object('estado',v_c.estado,'duplicada',false,'cancelar_no_mp',false);
end;
$$;


create or replace function public.minha_situacao()
returns jsonb language sql stable security definer set search_path = '' as $$
  with conta as (
    select u.id,u.created_at from auth.users u where u.id=auth.uid() and public.mfa_ok()
  ), todos_pagamentos as (
    select b.valido_ate,b.estado,c.plano,b.criado_em from public.cobrancas b
      join public.contratacoes c on c.id=b.contratacao_id where b.user_id=auth.uid()
    union all
    select x.valido_ate,x.status,x.plano,x.criado_em from public.compras x where x.user_id=auth.uid()
  ), pago as (
    select max(valido_ate) filter(where estado='aprovada') as pago_ate from todos_pagamentos
  ), plano_pago as (
    select plano from todos_pagamentos where estado='aprovada' order by valido_ate desc,criado_em desc limit 1
  ), viva as (
    select * from public.contratacoes c where c.user_id=auth.uid()
      and c.estado in ('checkout_pendente','aguardando_pagamento','ativa','pausada','falha_pagamento')
    order by c.criado_em desc limit 1
  ), ultimo as (
    select * from public.contratacoes c where c.user_id=auth.uid() and c.estado<>'abandonada'
    order by c.criado_em desc limit 1
  ), mensal as (
    select p.valor from public.planos p where p.id='mensal' and p.ativo
  ), promo as (
    select p.valor from public.planos p where p.id='mensal_promo' and p.ativo
      and not exists(select 1 from public.cobrancas b join public.contratacoes c on c.id=b.contratacao_id
        where c.user_id=auth.uid() and c.plano='mensal' and b.estado='aprovada')
      and not exists(select 1 from public.compras x where x.user_id=auth.uid() and x.plano='mensal' and x.status='aprovada')
  ), anual as (
    select p.valor from public.planos p where p.id='anual' and p.ativo
  ), hist as (
    select b.debitada_em as data,b.valor,b.estado from public.cobrancas b where b.user_id=auth.uid()
    union all select x.criado_em,x.valor,x.status from public.compras x where x.user_id=auth.uid()
  ), situacao as (
    select now() as agora,c.created_at+interval '3 days' as teste_ate,p.pago_ate,pp.plano,
      greatest(c.created_at+interval '3 days',p.pago_ate+
        case when v.estado in ('ativa','falha_pagamento') then interval '3 days' else interval '0 days' end) as liberado_ate,
      (select valor from mensal) as preco,(select valor from promo) as preco_promo,(select valor from anual) as preco_anual,
      coalesce(v.id,u.id) as contratacao_id,coalesce(v.estado,u.estado) as estado,
      coalesce(v.plano,u.plano) as plano_vivo,coalesce(v.valor_recorrente,u.valor_recorrente) as valor,
      coalesce(v.proxima_cobranca,u.proxima_cobranca) as proxima_cobranca,
      coalesce(v.autorizada_em,u.autorizada_em) as desde,
      coalesce(v.cancelada_em,u.cancelada_em) as cancelada_em,
      coalesce(v.init_point is not null and v.expira_em>now(),false) as checkout_aberto,
      v.sincronizada_em,v.estado as estado_vivo
    from conta c cross join pago p left join plano_pago pp on true left join viva v on true left join ultimo u on true
  )
  select jsonb_build_object(
    'agora',s.agora,'teste_ate',s.teste_ate,'pago_ate',s.pago_ate,'plano',s.plano,
    'liberado_ate',s.liberado_ate,'preco',s.preco,'preco_promo',s.preco_promo,'preco_anual',s.preco_anual,
    'assinatura',case when s.contratacao_id is null then null else jsonb_build_object('id',s.contratacao_id,'estado',s.estado,
      'plano',s.plano_vivo,'valor',s.valor,'proxima_cobranca',s.proxima_cobranca,'desde',s.desde,
      'cancelada_em',s.cancelada_em,'checkout_aberto',s.checkout_aberto) end,
    'cobrancas',coalesce((select jsonb_agg(jsonb_build_object('data',h.data,'valor',h.valor,'estado',h.estado) order by h.data desc nulls last)
      from (select * from hist order by data desc nulls last limit 6) h),'[]'::jsonb),
    'conferir',exists(select 1 from public.contratacoes c where c.user_id=auth.uid() and public.contratacao_revisavel(c.id) and (
      c.cancelamento_pendente or c.conferencia_falhou or
      (c.estado in ('cancelada','encerrada','abandonada') and (c.mp_plano_id is not null or c.mp_preapproval_id is not null
        or exists(select 1 from public.cobrancas b where b.contratacao_id=c.id))
        and (c.sincronizada_em is null or c.sincronizada_em<now()-interval '24 hours')) or
      exists(select 1 from public.planos_checkout p where p.contratacao_id=c.id and p.fechado_em is null and p.mp_plano_id is distinct from c.mp_plano_id)
    )) or coalesce(s.estado_vivo in ('aguardando_pagamento') or
      (s.estado_vivo in ('ativa','pausada','falha_pagamento','checkout_pendente') and
        (s.sincronizada_em is null or s.sincronizada_em<now()-interval '24 hours' or s.proxima_cobranca<=now())),false)
  ) from situacao s;
$$;


-- Compatibilidade durante a troca das funções: nem o gravador antigo pode sobrescrever um link entregue.
create or replace function public.gravar_checkout(p_id uuid,p_mp_plano_id text,p_init_point text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.contratacoes%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'permissao_negada' using errcode='42501'; end if;
  update public.contratacoes set mp_plano_id=p_mp_plano_id,init_point=p_init_point,atualizado_em=now()
    where id=p_id and estado='checkout_pendente' and not cancelamento_pendente
      and (mp_plano_id is null or mp_plano_id=p_mp_plano_id) returning * into v_row;
  if not found then raise exception 'checkout_ja_reservado'; end if;
  return to_jsonb(v_row);
end;
$$;

-- Recuperar projeções já incorretas no ambiente que recebeu a migração anterior.
-- Não há DELETE; pagamentos, valores e estados originais continuam no histórico.
insert into public.estornos_pagamento(mp_pagamento_id,mp_status)
  select distinct mp_pagamento_id,case when mp_pagamento_status='charged_back' then 'charged_back' else 'refunded' end
  from public.cobrancas where estado='estornada' and mp_pagamento_id is not null on conflict do nothing;
insert into public.planos_checkout(mp_plano_id,contratacao_id)
  select mp_plano_id,id from public.contratacoes where mp_plano_id is not null on conflict do nothing;
do $$
declare v_user uuid;
begin
  for v_user in select distinct user_id from public.cobrancas where estado='estornada' and user_id is not null loop
    perform public.recalcular_validade(v_user);
  end loop;
end;
$$;

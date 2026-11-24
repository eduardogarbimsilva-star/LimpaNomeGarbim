-- =========================================================
-- E08 — Pagamento automático pelo Asaas (PIX com confirmação por webhook)
-- A chave do Asaas e o token do webhook ficam só no servidor (privado.ajustes).
-- Sem Asaas configurado, continua o PIX direto com confirmação manual.
-- Só acrescenta. Desfazer: supabase/desfazer/e08.sql
-- =========================================================
insert into privado.ajustes (chave, valor) values
  ('gateway', ''), ('asaas_ambiente', ''), ('asaas_chave', ''), ('asaas_webhook_token', '')
on conflict (chave) do nothing;

alter table public.consultas add column if not exists gateway_id text;
alter table public.consultas add column if not exists pix_copia text;
alter table public.consultas add column if not exists pix_expira timestamptz;
create unique index if not exists consultas_gateway_id on public.consultas (gateway_id) where gateway_id is not null;

-- O site só precisa saber SE o pagamento automático está ligado
create or replace function public.pagamento_automatico() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select valor from privado.ajustes where chave = 'gateway'), '') <> ''
$$;
grant execute on function public.pagamento_automatico() to anon, authenticated;

-- Situação para o painel (sem a chave)
create or replace function public.situacao_gateway() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.eh_equipe() then jsonb_build_object(
    'gateway', (select valor from privado.ajustes where chave = 'gateway'),
    'ambiente', (select valor from privado.ajustes where chave = 'asaas_ambiente'),
    'chave', (select valor <> '' from privado.ajustes where chave = 'asaas_chave'))
  else null end
$$;
grant execute on function public.situacao_gateway() to authenticated;

-- Admin desliga o pagamento automático (volta para o PIX manual)
create or replace function public.desligar_gateway() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  update privado.ajustes set valor = '' where chave = 'gateway';
  insert into public.auditoria (quem, papel, tabela, acao, alvo, mudancas) values (public.meu_email(), 'admin', 'integracao', 'update', 'pagamento', '{"gateway": "manual"}');
end $$;
revoke all on function public.desligar_gateway() from public, anon;
grant execute on function public.desligar_gateway() to authenticated;

-- ---- Só para a função do servidor (service_role) ----
create or replace function public.config_gateway() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_object_agg(chave, valor) from privado.ajustes where chave in ('gateway', 'asaas_ambiente', 'asaas_chave', 'asaas_webhook_token')
$$;
create or replace function public.salvar_gateway(p_gateway text, p_ambiente text, p_chave text, p_token text, p_quem text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_gateway not in ('', 'asaas') or p_ambiente not in ('', 'sandbox', 'producao') then raise exception 'Configuração inválida.'; end if;
  update privado.ajustes set valor = p_gateway where chave = 'gateway';
  update privado.ajustes set valor = p_ambiente where chave = 'asaas_ambiente';
  if coalesce(p_chave, '') <> '' then update privado.ajustes set valor = p_chave where chave = 'asaas_chave'; end if;
  if coalesce(p_token, '') <> '' then update privado.ajustes set valor = p_token where chave = 'asaas_webhook_token'; end if;
  insert into public.auditoria (quem, papel, tabela, acao, alvo, mudancas)
  values (p_quem, 'admin', 'integracao', 'update', 'pagamento', jsonb_build_object('gateway', p_gateway, 'ambiente', p_ambiente, 'chave', 'valor oculto'));
end $$;
-- Pagamento confirmado pelo gateway: mesma regra do "Confirmar pagamento" da equipe
create or replace function public.pagamento_gateway_confirmado(p_id uuid, p_gateway_id text, p_valor numeric) returns text
language plpgsql security definer set search_path = public as $$
declare v_c public.consultas; v_prov text;
begin
  select * into v_c from public.consultas where id = p_id;
  if not found then return 'consulta não encontrada'; end if;
  if v_c.status <> 'aguardando_pagamento' then return 'já processada'; end if;
  if v_c.gateway_id is distinct from p_gateway_id then return 'cobrança não confere'; end if;
  if p_valor is null or p_valor + 0.009 < v_c.valor then return 'valor menor que o devido'; end if;
  select valor into v_prov from privado.ajustes where chave = 'consulta_provedor';
  update public.consultas set pagamento_status = 'pago', pago_em = now(), pagamento_meio = 'pix-asaas',
    status = case when coalesce(v_prov, '') = '' then 'autorizada' else 'em_andamento' end,
    modo = case when coalesce(v_prov, '') = '' then 'manual' else 'automatico' end, provedor = nullif(v_prov, ''), atualizado_em = now()
  where id = p_id;
  return 'pago';
end $$;
create or replace function public.pagamento_gateway_estornado(p_gateway_id text) returns text
language plpgsql security definer set search_path = public as $$
begin
  update public.consultas set pagamento_status = 'estornado', erro = 'Pagamento estornado no Asaas', atualizado_em = now() where gateway_id = p_gateway_id;
  return 'ok';
end $$;
revoke all on function public.config_gateway() from public, anon, authenticated;
revoke all on function public.salvar_gateway(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.pagamento_gateway_confirmado(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.pagamento_gateway_estornado(text) from public, anon, authenticated;
grant execute on function public.config_gateway() to service_role;
grant execute on function public.salvar_gateway(text, text, text, text, text) to service_role;
grant execute on function public.pagamento_gateway_confirmado(uuid, text, numeric) to service_role;
grant execute on function public.pagamento_gateway_estornado(text) to service_role;
notify pgrst, 'reload schema';

-- =========================================================
-- E06c — Consulta automática por fornecedor (Direct Data agora; Relinq quando liberar)
-- Depois do pagamento confirmado, a consulta vai para "em andamento" e a
-- função de eventos chama o fornecedor, grava o resultado e avisa o cliente.
-- Se o fornecedor falhar, a consulta volta para a fila manual da equipe.
-- A chave do fornecedor fica em privado.ajustes (fora do alcance do site).
-- Só acrescenta. Desfazer: supabase/desfazer/e06c.sql
-- =========================================================
insert into privado.ajustes (chave, valor) values ('directd_token', '') on conflict (chave) do nothing;
insert into privado.ajustes (chave, valor) values ('relinq_token', '') on conflict (chave) do nothing;

-- Admin escolhe o fornecedor e cola a chave (a chave nunca volta para o site)
create or replace function public.definir_integracao_consulta(p_provedor text, p_chave text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_tem text;
begin
  if not public.eh_admin() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  p_provedor := coalesce(trim(p_provedor), '');
  if p_provedor not in ('', 'directd', 'relinq') then raise exception 'Fornecedor inválido.'; end if;
  if p_provedor <> '' and coalesce(trim(p_chave), '') <> '' then
    if length(trim(p_chave)) < 8 or length(trim(p_chave)) > 400 then raise exception 'A chave parece inválida. Confira e cole de novo.'; end if;
    update privado.ajustes set valor = trim(p_chave) where chave = p_provedor || '_token';
  end if;
  if p_provedor <> '' then
    select valor into v_tem from privado.ajustes where chave = p_provedor || '_token';
    if coalesce(v_tem, '') = '' then raise exception 'Cole a chave de acesso do fornecedor para ativar a consulta automática.'; end if;
  end if;
  update privado.ajustes set valor = p_provedor where chave = 'consulta_provedor';
  insert into public.auditoria (quem, papel, tabela, acao, alvo, mudancas)
  values (public.meu_email(), 'admin', 'integracao', 'update', 'consultas', jsonb_build_object('provedor', p_provedor, 'chave', 'valor oculto'));
end $$;

-- Situação para o painel (sem nunca mostrar a chave)
create or replace function public.situacao_integracao_consulta()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.eh_equipe() then jsonb_build_object(
    'provedor', (select valor from privado.ajustes where chave = 'consulta_provedor'),
    'directd', (select valor <> '' from privado.ajustes where chave = 'directd_token'),
    'relinq', (select valor <> '' from privado.ajustes where chave = 'relinq_token'))
  else null end
$$;

-- Só a função do servidor (service_role) lê a chave
create or replace function public.config_fornecedor_consulta()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'provedor', (select valor from privado.ajustes where chave = 'consulta_provedor'),
    'token', (select valor from privado.ajustes where chave = (select valor from privado.ajustes where chave = 'consulta_provedor') || '_token'))
$$;
revoke all on function public.config_fornecedor_consulta() from public, anon, authenticated;
grant execute on function public.config_fornecedor_consulta() to service_role;

-- Cliente autoriza consulta pedida pela equipe: com fornecedor, já vai para a fila automática
create or replace function privado.consulta_automatica() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'scr' then   -- Registrato/SCR: só manual
    new.modo := 'manual'; new.provedor := null;
    if new.status = 'em_andamento' then new.status := 'autorizada'; end if;
  elsif new.status = 'autorizada' and new.modo = 'automatico' then new.status := 'em_andamento';
  end if;
  return new;
end $$;
drop trigger if exists consultas_automatica on public.consultas;
create trigger consultas_automatica before update on public.consultas for each row execute function privado.consulta_automatica();

-- Equipe manda tentar de novo no automático (depois de uma falha)
create or replace function public.reprocessar_consulta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prov text;
begin
  if not public.eh_equipe() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  select valor into v_prov from privado.ajustes where chave = 'consulta_provedor';
  if coalesce(v_prov, '') = '' then raise exception 'Nenhum fornecedor automático configurado.'; end if;
  update public.consultas set status = 'em_andamento', modo = 'automatico', provedor = v_prov, erro = null, atualizado_em = now()
  where id = p_id and status in ('falhou', 'autorizada') and (origem = 'equipe' or pagamento_status = 'pago');
  if not found then raise exception 'Esta consulta não pode ser reprocessada.'; end if;
end $$;

revoke all on function public.definir_integracao_consulta(text, text) from public, anon;
revoke all on function public.situacao_integracao_consulta() from public, anon;
revoke all on function public.reprocessar_consulta(uuid) from public, anon;
grant execute on function public.definir_integracao_consulta(text, text) to authenticated;
grant execute on function public.situacao_integracao_consulta() to authenticated;
grant execute on function public.reprocessar_consulta(uuid) to authenticated;
notify pgrst, 'reload schema';

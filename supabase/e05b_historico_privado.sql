-- =========================================================
-- E05b — Histórico privado
-- A aba Histórico saiu do painel. O registro continua no banco (segurança),
-- mas ninguém lê pelo site: só quem é dono do projeto no Supabase.
-- Valores sensíveis (PIX, CPF/CNPJ, e-mail, telefone, WhatsApp, endereço)
-- nunca são gravados no histórico: aparece só "valor oculto".
-- Desfazer: rodar de novo o trecho do histórico de supabase/e03_modulos.sql
-- =========================================================
drop policy if exists "admin lê o histórico" on public.auditoria;
revoke select on public.auditoria from authenticated, anon;

create or replace function privado.ocultar(j jsonb) returns jsonb
language plpgsql immutable as $$
declare k text; r jsonb;
  sensiveis constant text[] := array['pix', 'chave', 'cnpj', 'cpf', 'email', 'telefone', 'whatsapp', 'endereco', 'contatos', 'cep', 'logradouro', 'numero', 'inscricao', 'endpoint'];
begin
  if j is null or jsonb_typeof(j) <> 'object' then return j; end if;
  r := '{}'::jsonb;
  for k in select jsonb_object_keys(j) loop
    if k = any (sensiveis) then r := r || jsonb_build_object(k, 'valor oculto');
    else r := r || jsonb_build_object(k, privado.ocultar(j -> k)); end if;
  end loop;
  return r;
end $$;

create or replace function privado.auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_alvo text; v_mud jsonb; v_quem text := public.meu_email(); v_papel text;
begin
  select papel into v_papel from public.equipe where email = v_quem;
  if tg_table_name = 'pedidos' then
    -- só a mudança de situação (sem dados do cliente)
    if new.status is not distinct from old.status then return new; end if;
    v_alvo := new.numero;
    v_mud := jsonb_build_object('status', jsonb_build_object('antes', old.status, 'depois', new.status));
    if v_papel is null and auth.uid() = new.cliente_id then v_papel := 'cliente'; v_quem := 'cliente do pedido'; end if;
  elsif tg_op = 'DELETE' then
    v_alvo := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'email');
    v_mud := case when tg_table_name = 'configuracoes' then null else privado.diferenca(to_jsonb(old), null) end;
  elsif tg_op = 'INSERT' then
    v_alvo := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'email');
    v_mud := case when tg_table_name = 'configuracoes' then null else privado.diferenca(null, to_jsonb(new)) end;
  else
    v_alvo := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'email');
    if tg_table_name = 'configuracoes' then v_mud := privado.diferenca(old.dados, new.dados);
    else v_mud := privado.diferenca(to_jsonb(old) - 'atualizado_em' - 'atualizado_por', to_jsonb(new) - 'atualizado_em' - 'atualizado_por'); end if;
    if v_mud = '{}'::jsonb then return new; end if;
  end if;
  insert into public.auditoria (quem, papel, tabela, acao, alvo, mudancas)
  values (coalesce(v_quem, case when auth.role() = 'service_role' then 'sistema' else 'desconhecido' end), v_papel, tg_table_name, lower(tg_op), v_alvo, privado.ocultar(v_mud));
  return coalesce(new, old);
exception when others then
  return coalesce(new, old); -- o histórico nunca impede a alteração
end $$;

-- limpa o que já estava gravado
update public.auditoria set mudancas = privado.ocultar(mudancas) where mudancas is not null;
update public.modulos set descricao = 'Registro de quem mudou o quê, guardado só no banco (sem aba no painel e sem valores sensíveis).' where id = 'historico';
notify pgrst, 'reload schema';

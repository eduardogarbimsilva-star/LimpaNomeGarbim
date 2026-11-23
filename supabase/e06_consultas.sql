-- =========================================================
-- E06 — Central de consultas (CPF/CNPJ) com autorização do cliente
-- Fluxo: equipe pede -> cliente autoriza na área dele (texto + data/hora
-- guardados) -> consulta (manual pelo portal do revendedor, ou automática
-- quando a chave do fornecedor for configurada) -> resultado no pedido.
-- Nunca inventa resultado: só registra o que veio da fonte informada.
-- Só acrescenta. Desfazer: supabase/desfazer/e06.sql
-- =========================================================
create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  cliente_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('completa', 'restricoes', 'protestos', 'score', 'scr')),
  finalidade text not null check (length(finalidade) between 5 and 200),
  status text not null default 'aguardando_autorizacao'
    check (status in ('aguardando_autorizacao', 'autorizada', 'em_andamento', 'concluida', 'recusada', 'falhou', 'cancelada')),
  modo text not null default 'manual' check (modo in ('manual', 'automatico')),
  provedor text,
  consentimento_em timestamptz,
  consentimento_texto text,
  respondido_em timestamptz,
  resultado_resumo text check (length(resultado_resumo) <= 3000),
  pendencias jsonb not null default '[]'::jsonb,
  fonte text check (length(fonte) <= 150),
  data_consulta date,
  erro text,
  solicitado_por text,
  concluido_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists consultas_pedido on public.consultas (pedido_id);
create index if not exists consultas_cliente on public.consultas (cliente_id);
alter table public.consultas enable row level security;
drop policy if exists "consulta: cliente vê as suas, equipe vê todas" on public.consultas;
create policy "consulta: cliente vê as suas, equipe vê todas" on public.consultas for select to authenticated
  using (cliente_id = auth.uid() or public.eh_equipe());
grant select on public.consultas to authenticated;
grant all on public.consultas to service_role;
-- sem insert/update/delete pelo site: tudo passa pelas funções abaixo

-- Fornecedor automático (vazio = modo manual). Quando a Relinq liberar a API,
-- grava-se aqui o nome do fornecedor; a chave fica nos Secrets do Supabase.
insert into privado.ajustes (chave, valor) values ('consulta_provedor', '') on conflict (chave) do nothing;

create or replace function privado.nome_consulta(p_tipo text) returns text language sql immutable as $$
  select case p_tipo when 'completa' then 'consulta completa (restrições, protestos, score e Registrato/SCR)'
    when 'restricoes' then 'restrições no SPC, Serasa e Boa Vista' when 'protestos' then 'protestos em cartório (Cenprot)'
    when 'score' then 'score de crédito' when 'scr' then 'dívidas e atrasos com bancos (Registrato/SCR do Banco Central)' else p_tipo end
$$;

-- Equipe pede a consulta para um pedido
create or replace function public.solicitar_consulta(p_pedido uuid, p_tipo text, p_finalidade text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_p public.pedidos; v_id uuid;
begin
  if not public.eh_equipe() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  if not public.modulo_ativo('consultas') then raise exception 'A central de consultas está desligada (aba Módulos).'; end if;
  select * into v_p from public.pedidos where id = p_pedido;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if v_p.status = 'cancelado' then raise exception 'Este pedido está cancelado.'; end if;
  if exists (select 1 from public.consultas where pedido_id = p_pedido and tipo = p_tipo and status in ('aguardando_autorizacao', 'autorizada', 'em_andamento')) then
    raise exception 'Já existe uma consulta deste tipo em aberto para este pedido.';
  end if;
  insert into public.consultas (pedido_id, cliente_id, tipo, finalidade, solicitado_por)
  values (p_pedido, v_p.cliente_id, p_tipo, left(trim(p_finalidade), 200), public.meu_email()) returning id into v_id;
  insert into public.mensagens (pedido_id, autor, texto)
  values (p_pedido, 'sistema', 'A Milena pediu sua autorização para consultar ' || privado.nome_consulta(p_tipo) || '. Abra "Meus pedidos" para autorizar ou recusar.');
  return v_id;
end $$;

-- Cliente autoriza ou recusa (o texto exato do aceite fica guardado)
create or replace function public.responder_consulta(p_id uuid, p_autoriza boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.consultas; v_p public.pedidos; v_doc text; v_texto text; v_prov text;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  select * into v_c from public.consultas where id = p_id and cliente_id = auth.uid();
  if not found then raise exception 'Consulta não encontrada.'; end if;
  if v_c.status <> 'aguardando_autorizacao' then raise exception 'Esta consulta já foi respondida.'; end if;
  select * into v_p from public.pedidos where id = v_c.pedido_id;
  select coalesce(nullif(cpf, ''), cnpj) into v_doc from public.clientes where id = auth.uid();
  if not p_autoriza then
    update public.consultas set status = 'recusada', respondido_em = now(), atualizado_em = now() where id = p_id;
    insert into public.mensagens (pedido_id, autor, texto) values (v_c.pedido_id, 'sistema', 'O cliente não autorizou a consulta de ' || privado.nome_consulta(v_c.tipo) || '.');
    return;
  end if;
  v_texto := 'Eu, titular do documento ' || coalesce(v_doc, '(não informado)') || ', autorizo Milena Garbim · Limpa Nome a consultar ' || privado.nome_consulta(v_c.tipo)
    || ' em meu nome, exclusivamente para: ' || v_c.finalidade || ' (pedido ' || v_p.numero || '). Os dados serão usados somente neste atendimento, conforme a Política de Privacidade e a LGPD (Lei 13.709/2018). Autorizado em '
    || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || ' (horário de Brasília).';
  select valor into v_prov from privado.ajustes where chave = 'consulta_provedor';
  update public.consultas set status = 'autorizada', respondido_em = now(), consentimento_em = now(), consentimento_texto = v_texto,
    modo = case when coalesce(v_prov, '') = '' then 'manual' else 'automatico' end, provedor = nullif(v_prov, ''), atualizado_em = now()
  where id = p_id;
  insert into public.mensagens (pedido_id, autor, texto) values (v_c.pedido_id, 'sistema', 'Consulta autorizada pelo cliente: ' || privado.nome_consulta(v_c.tipo) || '.');
end $$;

-- Equipe registra o resultado (consulta manual no portal do revendedor)
create or replace function public.registrar_consulta(p_id uuid, p_resumo text, p_pendencias jsonb, p_fonte text, p_data date)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.consultas;
begin
  if not public.eh_equipe() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  select * into v_c from public.consultas where id = p_id;
  if not found then raise exception 'Consulta não encontrada.'; end if;
  if v_c.status not in ('autorizada', 'em_andamento', 'falhou') then raise exception 'Só dá para registrar resultado de consulta autorizada pelo cliente.'; end if;
  if coalesce(trim(p_fonte), '') = '' then raise exception 'Informe a fonte da consulta (ex.: portal do revendedor, Serasa, Registrato).'; end if;
  if p_data is null or p_data > current_date or p_data < v_c.consentimento_em::date then raise exception 'Data da consulta inválida (deve ser depois da autorização e não pode ser no futuro).'; end if;
  if coalesce(trim(p_resumo), '') = '' then raise exception 'Escreva o resumo do resultado.'; end if;
  if jsonb_typeof(coalesce(p_pendencias, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_pendencias, '[]'::jsonb)) > 100 then raise exception 'Lista de pendências inválida.'; end if;
  update public.consultas set status = 'concluida', resultado_resumo = left(trim(p_resumo), 3000), pendencias = coalesce(p_pendencias, '[]'::jsonb),
    fonte = left(trim(p_fonte), 150), data_consulta = p_data, concluido_por = public.meu_email(), erro = null, atualizado_em = now()
  where id = p_id;
  insert into public.mensagens (pedido_id, autor, texto) values (v_c.pedido_id, 'sistema', 'O resultado da consulta de ' || privado.nome_consulta(v_c.tipo) || ' está disponível em "Meus pedidos".');
end $$;

create or replace function public.cancelar_consulta(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_equipe() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  update public.consultas set status = 'cancelada', erro = left(coalesce(nullif(trim(p_motivo), ''), 'Cancelada pela equipe'), 300), atualizado_em = now()
  where id = p_id and status in ('aguardando_autorizacao', 'autorizada', 'em_andamento', 'falhou');
  if not found then raise exception 'Esta consulta não pode ser cancelada.'; end if;
end $$;

revoke all on function public.solicitar_consulta(uuid, text, text) from public, anon;
revoke all on function public.responder_consulta(uuid, boolean) from public, anon;
revoke all on function public.registrar_consulta(uuid, text, jsonb, text, date) from public, anon;
revoke all on function public.cancelar_consulta(uuid, text) from public, anon;
grant execute on function public.solicitar_consulta(uuid, text, text) to authenticated;
grant execute on function public.responder_consulta(uuid, boolean) to authenticated;
grant execute on function public.registrar_consulta(uuid, text, jsonb, text, date) to authenticated;
grant execute on function public.cancelar_consulta(uuid, text) to authenticated;

-- O módulo "Central de consultas" passa a poder ser ligado (continua DESLIGADO)
update public.modulos set disponivel = true, etapa = null,
  descricao = 'Consultas de CPF/CNPJ com autorização do cliente. Manual (portal do revendedor) até a chave da API do fornecedor ser configurada.'
where id = 'consultas';
notify pgrst, 'reload schema';

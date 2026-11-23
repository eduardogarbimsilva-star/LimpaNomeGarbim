-- =========================================================
-- E06b — Consultas em autoatendimento (o cliente escolhe, autoriza, paga e recebe)
-- Hoje: pagamento por PIX confirmado pela equipe com 1 clique e resultado
-- registrado pela equipe. Quando houver gateway de pagamento e a API do
-- fornecedor (Relinq), esses dois passos ficam automáticos, sem mudar a tela.
-- Só acrescenta. Desfazer: supabase/desfazer/e06b.sql
-- =========================================================

-- Produtos de consulta (preço definido pela dona do site; nada à venda sem preço)
create table if not exists public.consulta_produtos (
  id text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  tipo text not null check (tipo in ('completa', 'restricoes', 'protestos', 'score', 'scr')),
  nome text not null check (length(nome) <= 80),
  descricao text not null default '' check (length(descricao) <= 600),
  itens text[] not null default '{}',
  preco numeric(10, 2) check (preco is null or preco > 0),
  prazo text not null default 'Resultado em até 1 dia útil' check (length(prazo) <= 80),
  codigo_fornecedor text check (length(codigo_fornecedor) <= 80),
  destaque boolean not null default false,
  ativo boolean not null default false,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now()
);
alter table public.consulta_produtos enable row level security;
drop policy if exists "consulta à venda é pública" on public.consulta_produtos;
create policy "consulta à venda é pública" on public.consulta_produtos for select
  using ((ativo and preco is not null and public.modulo_ativo('consultas')) or public.eh_equipe());
drop policy if exists "admin edita consultas à venda" on public.consulta_produtos;
create policy "admin edita consultas à venda" on public.consulta_produtos for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
grant select on public.consulta_produtos to anon, authenticated;
grant update (nome, descricao, itens, preco, prazo, codigo_fornecedor, destaque, ativo, ordem) on public.consulta_produtos to authenticated;
grant all on public.consulta_produtos to service_role;
drop trigger if exists consulta_produtos_auditoria on public.consulta_produtos;
create trigger consulta_produtos_auditoria after insert or update or delete on public.consulta_produtos for each row execute function privado.auditar();

insert into public.consulta_produtos (id, tipo, nome, descricao, itens, destaque, ordem) values
  ('completa', 'completa', 'Consulta completa', 'Tudo o que pesa no seu nome em um só relatório, explicado em linguagem simples.',
    array['Restrições no SPC, Serasa e Boa Vista', 'Protestos em cartório (Cenprot)', 'Score de crédito', 'Dívidas com bancos (Registrato/SCR)'], true, 1),
  ('restricoes', 'restricoes', 'Restrições no nome', 'Veja se o seu CPF ou CNPJ está negativado e por quem.',
    array['SPC, Serasa e Boa Vista', 'Credor, valor e data de cada registro'], false, 2),
  ('protestos', 'protestos', 'Protestos em cartório', 'Consulta de protestos registrados na Central Nacional de Protesto.',
    array['Cartório, valor e data', 'Todos os estados'], false, 3),
  ('score', 'score', 'Score de crédito', 'Sua pontuação de crédito e o que ela significa.',
    array['Pontuação atual', 'O que ajuda e o que atrapalha'], false, 4),
  ('scr', 'scr', 'Dívidas com bancos (Bacen)', 'Empréstimos, financiamentos e atrasos registrados no Banco Central (SCR).',
    array['Dívidas em dia e em atraso', 'Prejuízos registrados pelos bancos'], false, 5)
on conflict (id) do nothing;

-- Consultas: agora também compradas pelo próprio cliente (sem pedido)
alter table public.consultas alter column pedido_id drop not null;
alter table public.consultas add column if not exists origem text not null default 'equipe' check (origem in ('equipe', 'cliente'));
alter table public.consultas add column if not exists produto_id text references public.consulta_produtos (id);
alter table public.consultas add column if not exists valor numeric(10, 2);
alter table public.consultas add column if not exists pagamento_status text not null default 'dispensado' check (pagamento_status in ('dispensado', 'pendente', 'pago', 'estornado'));
alter table public.consultas add column if not exists pagamento_ref text;
alter table public.consultas add column if not exists pagamento_meio text;
alter table public.consultas add column if not exists informou_pago_em timestamptz;
alter table public.consultas add column if not exists pago_em timestamptz;
alter table public.consultas add column if not exists numero text;
alter table public.consultas drop constraint if exists consultas_status_check;
alter table public.consultas add constraint consultas_status_check check (status in
  ('aguardando_pagamento', 'aguardando_autorizacao', 'autorizada', 'em_andamento', 'concluida', 'recusada', 'falhou', 'cancelada'));

-- Cliente compra a consulta do próprio CPF/CNPJ (a autorização é dada no mesmo passo)
create or replace function public.comprar_consulta(p_produto text, p_aceite boolean)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_prod public.consulta_produtos; v_cli public.clientes; v_doc text; v_id uuid; v_num text; v_texto text;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  if not public.modulo_ativo('consultas') then raise exception 'As consultas estão pausadas no momento.'; end if;
  if not coalesce(p_aceite, false) then raise exception 'Para continuar, marque a autorização da consulta.'; end if;
  select * into v_prod from public.consulta_produtos where id = p_produto and ativo and preco is not null;
  if not found then raise exception 'Esta consulta não está disponível.'; end if;
  select * into v_cli from public.clientes where id = auth.uid();
  v_doc := coalesce(nullif(v_cli.cpf, ''), nullif(v_cli.cnpj, ''));
  if v_doc is null then raise exception 'Complete seu cadastro (CPF ou CNPJ) em Minha conta antes de consultar.'; end if;
  -- não duplica: devolve a consulta igual que ainda espera pagamento
  select id into v_id from public.consultas where cliente_id = auth.uid() and produto_id = p_produto and status = 'aguardando_pagamento' order by criado_em desc limit 1;
  if v_id is not null then return v_id; end if;
  v_num := 'CS-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));
  v_texto := 'Eu, titular do documento ' || v_doc || ', autorizo Milena Garbim · Limpa Nome a consultar ' || privado.nome_consulta(v_prod.tipo)
    || ' em meu nome, exclusivamente para me entregar o resultado desta consulta (' || v_num || '). Os dados serão usados somente para este fim, conforme a Política de Privacidade e a LGPD (Lei 13.709/2018). Autorizado em '
    || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || ' (horário de Brasília).';
  insert into public.consultas (cliente_id, tipo, finalidade, status, origem, produto_id, valor, pagamento_status, pagamento_ref, pagamento_meio, numero,
    consentimento_em, consentimento_texto, respondido_em, solicitado_por)
  values (auth.uid(), v_prod.tipo, 'Entregar ao titular o resultado da consulta contratada no site', 'aguardando_pagamento', 'cliente', v_prod.id, v_prod.preco, 'pendente',
    replace(v_num, '-', ''), 'pix', v_num, now(), v_texto, now(), public.meu_email())
  returning id into v_id;
  return v_id;
end $$;

-- Cliente avisa que já pagou (a equipe recebe notificação para conferir)
create or replace function public.informar_pagamento_consulta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.consultas set informou_pago_em = coalesce(informou_pago_em, now()), atualizado_em = now()
  where id = p_id and cliente_id = auth.uid() and status = 'aguardando_pagamento';
  if not found then raise exception 'Consulta não encontrada.'; end if;
end $$;

-- Equipe confirma o pagamento (1 clique). Com gateway, isto será feito pelo aviso automático do banco.
create or replace function public.confirmar_pagamento_consulta(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_prov text;
begin
  if not public.eh_equipe() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  select valor into v_prov from privado.ajustes where chave = 'consulta_provedor';
  update public.consultas set pagamento_status = 'pago', pago_em = now(),
    status = case when coalesce(v_prov, '') = '' then 'autorizada' else 'em_andamento' end,
    modo = case when coalesce(v_prov, '') = '' then 'manual' else 'automatico' end, provedor = nullif(v_prov, ''), atualizado_em = now()
  where id = p_id and status = 'aguardando_pagamento';
  if not found then raise exception 'Esta consulta não está aguardando pagamento.'; end if;
end $$;

-- Resultado: consulta comprada só recebe resultado depois de paga
create or replace function privado.consulta_paga() returns trigger
language plpgsql as $$
begin
  if new.status = 'concluida' and new.origem = 'cliente' and new.pagamento_status <> 'pago' then
    raise exception 'Confirme o pagamento antes de registrar o resultado.';
  end if;
  return new;
end $$;
drop trigger if exists consultas_paga on public.consultas;
create trigger consultas_paga before update on public.consultas for each row execute function privado.consulta_paga();

-- Avisos (notificação no celular/computador) a cada mudança importante
create or replace function privado.avisar_consulta() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_seg text; v_ev text; v_nome text;
begin
  if tg_op = 'INSERT' then v_ev := case when new.origem = 'cliente' then 'nova' else 'pedido_autorizacao' end;
  elsif new.informou_pago_em is not null and old.informou_pago_em is null then v_ev := 'informou_pagamento';
  elsif new.status is distinct from old.status then v_ev := new.status;
  else return new; end if;
  select valor into v_url from privado.ajustes where chave = 'eventos_url';
  select valor into v_seg from privado.ajustes where chave = 'eventos_segredo';
  if v_url is null or v_seg is null then return new; end if;
  select nome into v_nome from public.consulta_produtos where id = new.produto_id;
  perform net.http_post(url := v_url,
    body := jsonb_build_object('tabela', 'consultas', 'evento', v_ev, 'registro', jsonb_build_object(
      'id', new.id, 'numero', coalesce(new.numero, ''), 'cliente_id', new.cliente_id, 'pedido_id', new.pedido_id,
      'produto', coalesce(v_nome, privado.nome_consulta(new.tipo)), 'valor', new.valor, 'origem', new.origem)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-evento-segredo', v_seg), timeout_milliseconds := 15000);
  return new;
exception when others then return new;
end $$;
drop trigger if exists consultas_evento on public.consultas;
create trigger consultas_evento after insert or update on public.consultas for each row execute function privado.avisar_consulta();

revoke all on function public.comprar_consulta(text, boolean) from public, anon;
revoke all on function public.informar_pagamento_consulta(uuid) from public, anon;
revoke all on function public.confirmar_pagamento_consulta(uuid) from public, anon;
grant execute on function public.comprar_consulta(text, boolean) to authenticated;
grant execute on function public.informar_pagamento_consulta(uuid) to authenticated;
grant execute on function public.confirmar_pagamento_consulta(uuid) to authenticated;

update public.modulos set descricao = 'Página /consultas: o cliente escolhe, autoriza, paga por PIX e recebe o resultado na conta. Pagamento e consulta ficam automáticos quando o gateway e a API do fornecedor forem configurados.'
where id = 'consultas';
-- consultas compradas no site não têm pedido: o aviso no chat só vale para consultas ligadas a pedido
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
  if v_c.pedido_id is not null then
    insert into public.mensagens (pedido_id, autor, texto) values (v_c.pedido_id, 'sistema', 'O resultado da consulta de ' || privado.nome_consulta(v_c.tipo) || ' está disponível em "Meus pedidos".');
  end if;
end $$;
notify pgrst, 'reload schema';

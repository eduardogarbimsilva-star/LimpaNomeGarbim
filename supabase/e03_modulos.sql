-- =========================================================
-- E03 — Controle modular do proprietário + histórico de alterações
-- Só acrescenta (tabelas, funções, gatilhos). Nada é apagado.
-- Para desfazer: supabase/desfazer/e03.sql
-- =========================================================

-- ---------------------------------------------------------
-- Módulos: liga/desliga por recurso do site
--   ativo       -> ligado ou desligado
--   fixo        -> proteção de segurança: sempre ligada, ninguém desliga
--   disponivel  -> false = recurso ainda não construído (chega numa próxima etapa)
-- ---------------------------------------------------------
create table if not exists public.modulos (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  grupo text not null default 'site' check (grupo in ('atendimento', 'site', 'novos', 'seguranca')),
  nome text not null check (length(nome) <= 80),
  descricao text not null default '' check (length(descricao) <= 400),
  ativo boolean not null default false,
  fixo boolean not null default false,
  disponivel boolean not null default true,
  etapa text,
  ordem int not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
alter table public.modulos enable row level security;
drop policy if exists "módulos visíveis" on public.modulos;
create policy "módulos visíveis" on public.modulos for select using (true);
-- só administrador (com dupla verificação) altera; nenhuma política de insert/delete pelo site
drop policy if exists "admin liga e desliga módulos" on public.modulos;
create policy "admin liga e desliga módulos" on public.modulos for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
grant select on public.modulos to anon, authenticated;
grant update (ativo) on public.modulos to authenticated;
grant all on public.modulos to service_role;

-- Regras que o banco garante, mesmo que alguém tente pelo navegador:
-- módulo fixo nunca desliga; módulo ainda não disponível nunca liga; só "ativo" pode mudar pelo painel
create or replace function privado.proteger_modulo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.fixo and not new.ativo then raise exception 'Esta proteção de segurança não pode ser desligada.'; end if;
  if not old.disponivel and new.ativo then raise exception 'Este recurso ainda não está pronto para ser ligado.'; end if;
  if auth.role() <> 'service_role' and (new.id, new.grupo, new.nome, new.descricao, new.fixo, new.disponivel, new.etapa, new.ordem)
     is distinct from (old.id, old.grupo, old.nome, old.descricao, old.fixo, old.disponivel, old.etapa, old.ordem) then
    raise exception 'Só é possível ligar ou desligar o módulo.';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := coalesce(public.meu_email(), 'sistema');
  return new;
end $$;
drop trigger if exists modulos_proteger on public.modulos;
create trigger modulos_proteger before update on public.modulos for each row execute function privado.proteger_modulo();

create or replace function public.modulo_ativo(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ativo from public.modulos where id = p_id), true)
$$;
grant execute on function public.modulo_ativo(text) to anon, authenticated, service_role;

-- Catálogo de módulos. Os que já existem no site começam LIGADOS (nada muda para ninguém);
-- os novos do V3.1 começam DESLIGADOS e indisponíveis até a etapa em que forem construídos.
insert into public.modulos (id, grupo, nome, descricao, ativo, fixo, disponivel, etapa, ordem) values
  ('pedidos',              'atendimento', 'Pedidos pelo site',             'Clientes escolhem serviços e enviam o pedido pela área do cliente.', true, false, true, null, 1),
  ('chat',                 'atendimento', 'Chat do pedido',                'Conversa entre cliente e equipe dentro de cada pedido.', true, false, true, null, 2),
  ('assistente',           'atendimento', 'Assistente automática',         'Responde o cliente no chat (grátis, por regras) até alguém da equipe assumir.', true, false, true, null, 3),
  ('pix',                  'atendimento', 'Cobrança PIX no chat',          'A equipe envia QR Code e copia-e-cola com o valor definido.', true, false, true, null, 4),
  ('cancelamento_cliente', 'atendimento', 'Cliente cancela o próprio pedido', 'Botão de cancelar (com motivo obrigatório) enquanto o serviço não começou.', true, false, true, null, 5),
  ('notificacoes',         'atendimento', 'Notificações no celular/computador', 'Avisos de pedido novo, mensagens e mudança de situação.', true, false, true, null, 6),
  ('busca_cep',            'site',        'Endereço automático pelo CEP',  'Preenche rua, bairro, cidade e estado pelo CEP (ViaCEP, gratuito).', true, false, true, null, 1),
  ('busca_cnpj',           'site',        'Dados da empresa pelo CNPJ',    'Preenche razão social e endereço pelo CNPJ (BrasilAPI, gratuito).', true, false, true, null, 2),
  ('triagem',              'site',        'Pergunta inicial "Como está o seu nome?"', 'Janela que ajuda o visitante a filtrar os serviços.', true, false, true, null, 3),
  ('catalogo_ditto',       'novos',       'Produtos de crédito (Ditto)',   '20 produtos do portfólio Ditto, todos como rascunho até você confirmar parceria e regras.', false, false, false, 'E04', 1),
  ('diagnostico',          'novos',       'Diagnóstico inteligente',       'Perguntas condicionais que indicam o caminho, com explicação de cada resultado.', false, false, false, 'E05', 2),
  ('consultas',            'novos',       'Central de consultas',          'Consultas a birôs só por fornecedor contratado e com autorização do cliente.', false, false, false, 'E06', 3),
  ('relatorios',           'novos',       'Relatórios em PDF',             'Relatórios protegidos, com fonte e data, só com dados reais.', false, false, false, 'E07', 4),
  ('pagamentos',           'novos',       'Pagamento online',              'Cartão/boleto/PIX automático por um gateway, com estorno e conciliação.', false, false, false, 'E08', 5),
  ('crm',                  'novos',       'CRM e métricas',                'Funil de atendimento, indicadores reais e exportação segura.', false, false, false, 'E10', 6),
  ('dupla_verificacao',    'seguranca',   'Dupla verificação da equipe',   'Código do aplicativo autenticador para entrar no painel.', true, true, true, null, 1),
  ('regras_banco',         'seguranca',   'Regras de acesso do banco (RLS)', 'Cada cliente só vê os próprios dados; só a equipe vê os pedidos.', true, true, true, null, 2),
  ('validacao_servidor',   'seguranca',   'Validação no servidor',         'CPF, CNPJ, estado e limites conferidos pelo banco, não só pelo navegador.', true, true, true, null, 3),
  ('historico',            'seguranca',   'Histórico de alterações',       'Registro de quem mudou o quê no painel.', true, true, true, null, 4)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- O banco respeita os módulos (não depende só de esconder botão)
-- ---------------------------------------------------------
create or replace function privado.exigir_modulos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'pedidos' and tg_op = 'INSERT' then
    if not public.modulo_ativo('pedidos') then raise exception 'Pedidos pelo site estão pausados no momento. Fale com a gente pelo WhatsApp.'; end if;
  elsif tg_table_name = 'pedidos' and tg_op = 'UPDATE' then
    if new.status = 'cancelado' and old.status <> 'cancelado' and auth.uid() = new.cliente_id
       and not public.eh_equipe() and not public.modulo_ativo('cancelamento_cliente') then
      raise exception 'O cancelamento pelo site está desativado. Fale com a Milena pelo chat ou WhatsApp.';
    end if;
  elsif tg_table_name = 'mensagens' then
    if new.autor = 'cliente' and not public.modulo_ativo('chat') then raise exception 'O chat está pausado no momento. Fale com a gente pelo WhatsApp.'; end if;
    if new.pix is not null and not public.modulo_ativo('pix') then raise exception 'A cobrança PIX está desativada nos módulos.'; end if;
    if new.autor = 'ia' and not public.modulo_ativo('assistente') then raise exception 'ASSISTENTE_DESLIGADA'; end if;
  end if;
  return new;
end $$;
drop trigger if exists pedidos_modulos on public.pedidos;
create trigger pedidos_modulos before insert or update of status on public.pedidos for each row execute function privado.exigir_modulos();
drop trigger if exists mensagens_modulos on public.mensagens;
create trigger mensagens_modulos before insert on public.mensagens for each row execute function privado.exigir_modulos();

-- ---------------------------------------------------------
-- Histórico de alterações (trilha de auditoria)
-- Só o banco escreve (gatilhos). Só administrador lê. Ninguém edita nem apaga pelo site.
-- Não guarda dados de clientes: só o que mudou em configurações, catálogo, equipe,
-- módulos e a situação dos pedidos.
-- ---------------------------------------------------------
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  quem text,
  papel text,
  tabela text not null,
  acao text not null,
  alvo text,
  mudancas jsonb
);
create index if not exists auditoria_quando on public.auditoria (quando desc);
alter table public.auditoria enable row level security;
drop policy if exists "admin lê o histórico" on public.auditoria;
create policy "admin lê o histórico" on public.auditoria for select to authenticated using (public.eh_admin());
grant select on public.auditoria to authenticated;
grant all on public.auditoria to service_role;

-- diferença entre dois jsonb, até 2 níveis, com valores encurtados
create or replace function privado.diferenca(a jsonb, b jsonb, nivel int default 1) returns jsonb
language plpgsql immutable as $$
declare k text; r jsonb := '{}'::jsonb; va jsonb; vb jsonb;
  curto constant int := 300;
begin
  a := coalesce(a, '{}'::jsonb); b := coalesce(b, '{}'::jsonb);
  for k in select jsonb_object_keys(a) union select jsonb_object_keys(b) loop
    va := a -> k; vb := b -> k;
    if va is distinct from vb then
      if nivel < 2 and jsonb_typeof(va) = 'object' and jsonb_typeof(vb) = 'object' then
        r := r || jsonb_build_object(k, privado.diferenca(va, vb, nivel + 1));
      else
        r := r || jsonb_build_object(k, jsonb_build_object(
          'antes', case when va is null then null when length(va::text) > curto then to_jsonb(left(va::text, curto) || '…') else va end,
          'depois', case when vb is null then null when length(vb::text) > curto then to_jsonb(left(vb::text, curto) || '…') else vb end));
      end if;
    end if;
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
  values (coalesce(v_quem, case when auth.role() = 'service_role' then 'sistema' else 'desconhecido' end), v_papel, tg_table_name, lower(tg_op), v_alvo, v_mud);
  return coalesce(new, old);
exception when others then
  return coalesce(new, old); -- o histórico nunca impede a alteração
end $$;

do $$ declare t text; begin
  foreach t in array array['configuracoes', 'categorias', 'servicos', 'equipe', 'modulos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function privado.auditar()', t || '_auditoria', t);
  end loop;
end $$;
drop trigger if exists pedidos_auditoria on public.pedidos;
create trigger pedidos_auditoria after update of status on public.pedidos for each row execute function privado.auditar();

notify pgrst, 'reload schema';

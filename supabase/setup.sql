-- =========================================================
-- Milena Garbim · Limpa Nome — estrutura do banco (Supabase)
-- Cole TUDO em: Supabase > SQL Editor > New query > Run
-- Pode rodar de novo sem problema (não apaga dados).
--
-- A última linha libera millenagarbim@gmail.com como administradora do painel.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- Validações (as mesmas do site; o banco confere de novo)
-- ---------------------------------------------------------
create or replace function public.so_digitos(v text) returns text
language sql immutable as $$ select regexp_replace(coalesce(v, ''), '\D', '', 'g') $$;

create or replace function public.cpf_valido(v text) returns boolean
language plpgsql immutable as $$
declare c text := public.so_digitos(v); s int; t int; i int;
begin
  if length(c) <> 11 or c ~ '^(\d)\1+$' then return false; end if;
  for t in 9..10 loop
    s := 0;
    for i in 1..t loop s := s + substr(c, i, 1)::int * (t + 2 - i); end loop;
    if ((s * 10) % 11) % 10 <> substr(c, t + 1, 1)::int then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.cnpj_valido(v text) returns boolean
language plpgsql immutable as $$
declare c text := public.so_digitos(v); n int; i int; s int; p int; r int;
begin
  if length(c) <> 14 or c ~ '^(\d)\1+$' then return false; end if;
  for n in 12..13 loop
    s := 0; p := n - 7;
    for i in 1..n loop
      s := s + substr(c, i, 1)::int * p;
      p := p - 1; if p < 2 then p := 9; end if;
    end loop;
    r := s % 11;
    if (case when r < 2 then 0 else 11 - r end) <> substr(c, n + 1, 1)::int then return false; end if;
  end loop;
  return true;
end $$;

-- ---------------------------------------------------------
-- Equipe (quem entra no painel)
--   admin     = tudo
--   atendente = pedidos e clientes
-- ---------------------------------------------------------
create table if not exists public.equipe (
  email text primary key check (email = lower(email)),
  papel text not null default 'atendente' check (papel in ('admin', 'atendente')),
  nome text check (length(nome) <= 60),      -- nome que o cliente vê no chat
  criado_em timestamptz not null default now()
);
alter table public.equipe add column if not exists nome text check (length(nome) <= 60);

create or replace function public.meu_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.equipe where email = public.meu_email()
$$;
-- Nome que aparece para o cliente (nunca o e-mail da pessoa da equipe)
create or replace function public.meu_nome_equipe() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(nome), ''), 'Equipe Milena Garbim') from public.equipe where email = public.meu_email()
$$;
create or replace function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where email = public.meu_email())
$$;
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipe where email = public.meu_email() and papel = 'admin')
$$;

alter table public.equipe enable row level security;
drop policy if exists "equipe vê equipe" on public.equipe;
create policy "equipe vê equipe" on public.equipe for select to authenticated using (public.eh_equipe());
drop policy if exists "admin gerencia equipe" on public.equipe;
create policy "admin gerencia equipe" on public.equipe for all to authenticated
  using (public.eh_admin() and email <> public.meu_email())
  with check (public.eh_admin() and email <> public.meu_email());

-- ---------------------------------------------------------
-- Clientes (cadastro pessoa física ou empresa)
-- ---------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  tipo text check (tipo in ('pf', 'pj')),
  nome text check (length(nome) <= 100),
  cpf text check (length(cpf) <= 14),
  razao_social text check (length(razao_social) <= 150),
  nome_fantasia text check (length(nome_fantasia) <= 150),
  cnpj text check (length(cnpj) <= 18),
  responsavel text check (length(responsavel) <= 100),
  telefone text check (length(telefone) <= 20),
  cep text check (length(cep) <= 9),
  logradouro text check (length(logradouro) <= 150),
  numero text check (length(numero) <= 20),
  complemento text check (length(complemento) <= 80),
  bairro text check (length(bairro) <= 80),
  cidade text check (length(cidade) <= 80),
  uf text check (uf is null or uf = '' or uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists clientes_email_unico on public.clientes (lower(email));
create unique index if not exists clientes_cpf_unico on public.clientes (public.so_digitos(cpf)) where coalesce(cpf, '') <> '';
create unique index if not exists clientes_cnpj_unico on public.clientes (public.so_digitos(cnpj)) where coalesce(cnpj, '') <> '';

create or replace function public.clientes_antes_de_salvar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.email := public.meu_email(); end if;
  if tg_op = 'INSERT' then new.criado_em := now(); else new.criado_em := old.criado_em; end if;
  new.atualizado_em := now();
  if coalesce(new.cpf, '') <> '' and not public.cpf_valido(new.cpf) then
    raise exception 'CPF inválido' using errcode = '23514'; end if;
  if coalesce(new.cnpj, '') <> '' and not public.cnpj_valido(new.cnpj) then
    raise exception 'CNPJ inválido' using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists clientes_antes_de_salvar on public.clientes;
create trigger clientes_antes_de_salvar before insert or update on public.clientes
  for each row execute function public.clientes_antes_de_salvar();

alter table public.clientes enable row level security;
drop policy if exists "cliente vê o próprio cadastro" on public.clientes;
create policy "cliente vê o próprio cadastro" on public.clientes for select to authenticated
  using (id = auth.uid() or public.eh_equipe());
drop policy if exists "cliente cria o próprio cadastro" on public.clientes;
create policy "cliente cria o próprio cadastro" on public.clientes for insert to authenticated with check (id = auth.uid());
drop policy if exists "cliente altera o próprio cadastro" on public.clientes;
create policy "cliente altera o próprio cadastro" on public.clientes for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- "Criar conta" com um e-mail que já tem cadastro: o site avisa e entra em vez de criar outra
create or replace function public.email_ja_cadastrado(e text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clientes where lower(email) = lower(trim(e)) and tipo is not null)
$$;

-- ---------------------------------------------------------
-- Catálogo: categorias e serviços (editados pelo painel)
-- ---------------------------------------------------------
create table if not exists public.categorias (
  id text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  dados jsonb not null default '{}'::jsonb,
  ordem int not null default 0,
  ativo boolean not null default true
);
create table if not exists public.servicos (
  id text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  categoria text not null references public.categorias (id) on update cascade,
  dados jsonb not null default '{}'::jsonb,
  ordem int not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

alter table public.categorias enable row level security;
alter table public.servicos enable row level security;
drop policy if exists "catálogo visível" on public.categorias;
create policy "catálogo visível" on public.categorias for select using (ativo or public.eh_equipe());
drop policy if exists "admin edita categorias" on public.categorias;
create policy "admin edita categorias" on public.categorias for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "serviços visíveis" on public.servicos;
create policy "serviços visíveis" on public.servicos for select using (ativo or public.eh_equipe());
drop policy if exists "admin edita serviços" on public.servicos;
create policy "admin edita serviços" on public.servicos for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- ---------------------------------------------------------
-- Configurações do site (uma linha): contatos, textos, fotos e dúvidas
-- ---------------------------------------------------------
create table if not exists public.configuracoes (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
insert into public.configuracoes (id) values (1) on conflict do nothing;
alter table public.configuracoes enable row level security;
drop policy if exists "configurações públicas" on public.configuracoes;
create policy "configurações públicas" on public.configuracoes for select using (true);
drop policy if exists "admin edita configurações" on public.configuracoes;
create policy "admin edita configurações" on public.configuracoes for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- ---------------------------------------------------------
-- Pedidos (solicitações de serviço) e andamento
-- O cliente não grava direto: o pedido entra pelo criar_pedido (o banco confere preços e cadastro)
-- e o andamento só muda pelas funções abaixo.
-- ---------------------------------------------------------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  cliente_id uuid references auth.users (id) on delete set null,
  cliente jsonb not null default '{}'::jsonb,
  itens jsonb not null default '[]'::jsonb,
  observacoes text check (length(observacoes) <= 800),
  total numeric(12, 2) not null default 0,
  status text not null default 'recebido'
    check (status in ('recebido', 'em_analise', 'confirmado', 'aguardando_cliente', 'em_andamento', 'concluido', 'cancelado')),
  andamento jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pedidos_cliente on public.pedidos (cliente_id, criado_em desc);
-- Confirmação pela vendedora: libera o chat do pedido
alter table public.pedidos add column if not exists confirmado_em timestamptz;
alter table public.pedidos drop constraint if exists pedidos_status_check;
alter table public.pedidos add constraint pedidos_status_check
  check (status in ('recebido', 'em_analise', 'confirmado', 'aguardando_cliente', 'em_andamento', 'concluido', 'cancelado'));
alter table public.pedidos enable row level security;
drop policy if exists "cliente vê os próprios pedidos" on public.pedidos;
create policy "cliente vê os próprios pedidos" on public.pedidos for select to authenticated
  using (cliente_id = auth.uid() or public.eh_equipe());
drop policy if exists "admin exclui pedidos" on public.pedidos;
create policy "admin exclui pedidos" on public.pedidos for delete to authenticated using (public.eh_admin());

create or replace function public.criar_pedido(p_itens jsonb, p_obs text default null)
returns table (pedido_id uuid, numero_pedido text, valor numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_cli public.clientes; v_sid text; v_dados jsonb; v_cat text; v_preco numeric;
  v_itens jsonb := '[]'::jsonb; v_total numeric := 0; v_num text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  select * into v_cli from public.clientes c where c.id = auth.uid();
  if not found or v_cli.tipo is null or coalesce(v_cli.telefone, '') = '' or coalesce(v_cli.cidade, '') = '' or coalesce(v_cli.uf, '') = ''
     or (v_cli.tipo = 'pf' and (coalesce(v_cli.nome, '') = '' or coalesce(v_cli.cpf, '') = ''))
     or (v_cli.tipo = 'pj' and (coalesce(v_cli.razao_social, '') = '' or coalesce(v_cli.cnpj, '') = '' or coalesce(v_cli.responsavel, '') = ''))
  then raise exception 'CADASTRO_INCOMPLETO'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 20 then
    raise exception 'SEM_ITENS'; end if;

  for v_sid in select distinct x from jsonb_array_elements_text(p_itens) as t(x) loop
    select s.dados, c.dados ->> 'nome' into v_dados, v_cat
      from public.servicos s join public.categorias c on c.id = s.categoria
     where s.id = v_sid and s.ativo and c.ativo;
    if not found then raise exception 'SERVICO_INDISPONIVEL'; end if;
    v_preco := case when jsonb_typeof(v_dados -> 'preco') = 'number' and (v_dados ->> 'preco')::numeric > 0
                    then (v_dados ->> 'preco')::numeric end;
    v_itens := v_itens || jsonb_build_object('id', v_sid, 'nome', v_dados ->> 'nome', 'categoria', v_cat,
      'preco', v_preco, 'a_partir', coalesce((v_dados ->> 'aPartir')::boolean, false));
    v_total := v_total + coalesce(v_preco, 0);
  end loop;

  loop
    v_num := 'MG-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYMMDD') || '-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from public.pedidos p where p.numero = v_num);
  end loop;

  insert into public.pedidos (numero, cliente_id, cliente, itens, observacoes, total, status, andamento)
  values (v_num, auth.uid(), to_jsonb(v_cli), v_itens, left(nullif(trim(p_obs), ''), 800), v_total, 'recebido',
          jsonb_build_array(jsonb_build_object('data', now(), 'autor', 'sistema', 'status', 'recebido', 'texto', 'Solicitação recebida pelo site.')))
  returning id into v_id;
  return query select v_id, v_num, v_total;
end $$;

-- Equipe: muda a situação e/ou escreve uma atualização para o cliente
create or replace function public.atualizar_pedido(p_id uuid, p_status text default null, p_texto text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_atual text; v_texto text := left(nullif(trim(p_texto), ''), 1000);
begin
  if not public.eh_equipe() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  select status into v_atual from public.pedidos where id = p_id;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if p_status is not null and p_status not in ('recebido', 'em_analise', 'confirmado', 'aguardando_cliente', 'em_andamento', 'concluido', 'cancelado') then
    raise exception 'Situação inválida.'; end if;
  if (p_status is null or p_status = v_atual) and v_texto is null then
    raise exception 'Escolha uma nova situação ou escreva uma mensagem.'; end if;
  update public.pedidos set
    status = coalesce(p_status, status),
    -- confirmado (ou já em andamento/concluído) = pedido aceito pela vendedora: o chat abre
    confirmado_em = case when p_status in ('confirmado', 'aguardando_cliente', 'em_andamento', 'concluido')
                         then coalesce(confirmado_em, now()) else confirmado_em end,
    andamento = andamento || jsonb_strip_nulls(jsonb_build_object('data', now(), 'autor', 'equipe', 'nome', public.meu_nome_equipe(),
      'status', case when p_status is not null and p_status <> v_atual then p_status end, 'texto', v_texto)),
    atualizado_em = now()
  where id = p_id;
end $$;

-- ---------------------------------------------------------
-- Chat do pedido (cliente <-> vendedora)
-- Abre só depois que a vendedora confirma o pedido; fecha se o pedido for cancelado.
-- ---------------------------------------------------------
drop function if exists public.mensagem_cliente(uuid, text);

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  autor text not null check (autor in ('cliente', 'equipe')),
  nome text,
  texto text not null default '' check (length(texto) <= 2000),
  anexo text,                 -- foto enviada no chat (caminho na pasta privada "chat")
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);
-- Mensagem com foto: o texto passa a ser opcional
alter table public.mensagens add column if not exists anexo text;
alter table public.mensagens alter column texto set default '';
alter table public.mensagens drop constraint if exists mensagens_texto_check;
alter table public.mensagens drop constraint if exists mensagens_conteudo;
alter table public.mensagens add constraint mensagens_conteudo check (length(texto) <= 2000 and (texto <> '' or anexo is not null));
create index if not exists mensagens_pedido on public.mensagens (pedido_id, criado_em);
alter table public.mensagens enable row level security;
drop policy if exists "chat: cliente do pedido e equipe" on public.mensagens;
create policy "chat: cliente do pedido e equipe" on public.mensagens for select to authenticated
  using (public.eh_equipe() or exists (select 1 from public.pedidos p where p.id = pedido_id and p.cliente_id = auth.uid()));

-- p_como: 'cliente' (dono do pedido) ou 'equipe'; p_anexo: foto já enviada para a pasta "chat/<pedido>/..."
drop function if exists public.enviar_mensagem(uuid, text, text);
create or replace function public.enviar_mensagem(p_pedido uuid, p_texto text, p_como text default 'cliente', p_anexo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p public.pedidos; v_texto text := coalesce(left(trim(p_texto), 2000), ''); v_nome text; r public.mensagens;
begin
  if v_texto = '' and p_anexo is null then raise exception 'Escreva a mensagem.'; end if;
  if p_anexo is not null and (p_anexo not like p_pedido::text || '/%' or p_anexo ~ '\.\.' or length(p_anexo) > 200) then
    raise exception 'Foto inválida.'; end if;
  select * into v_p from public.pedidos where id = p_pedido;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if p_como = 'equipe' then
    if not public.eh_equipe() then raise exception 'Sem permissão' using errcode = '42501'; end if;
    v_nome := public.meu_nome_equipe();
  elsif p_como = 'cliente' then
    if v_p.cliente_id is distinct from auth.uid() then raise exception 'Pedido não encontrado.'; end if;
  else raise exception 'Remetente inválido.'; end if;
  if v_p.confirmado_em is null or v_p.status = 'cancelado' then raise exception 'CHAT_FECHADO'; end if;
  insert into public.mensagens (pedido_id, autor, nome, texto, anexo) values (p_pedido, p_como, v_nome, v_texto, p_anexo) returning * into r;
  update public.pedidos set atualizado_em = now() where id = p_pedido;
  return to_jsonb(r);
end $$;

-- Marca como lidas as mensagens do outro lado
create or replace function public.marcar_lidas(p_pedido uuid, p_como text default 'cliente')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_como = 'equipe' and not public.eh_equipe() then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if p_como = 'cliente' and not exists (select 1 from public.pedidos where id = p_pedido and cliente_id = auth.uid()) then return; end if;
  update public.mensagens set lida_em = now() where pedido_id = p_pedido and lida_em is null and autor <> p_como;
end $$;

-- Fotos do chat: pasta PRIVADA "chat", organizada por pedido (chat/<id do pedido>/foto.jpg).
-- Só o cliente do pedido e a equipe veem; enviar só com o chat aberto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;
create or replace function public.pode_ver_foto_chat(p_nome text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_equipe() or exists (select 1 from public.pedidos p where p.id::text = split_part(p_nome, '/', 1) and p.cliente_id = auth.uid())
$$;
create or replace function public.pode_enviar_foto_chat(p_nome text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pedidos p where p.id::text = split_part(p_nome, '/', 1)
    and p.confirmado_em is not null and p.status <> 'cancelado' and (p.cliente_id = auth.uid() or public.eh_equipe()))
$$;
drop policy if exists "fotos do chat: ver" on storage.objects;
create policy "fotos do chat: ver" on storage.objects for select to authenticated using (bucket_id = 'chat' and public.pode_ver_foto_chat(name));
drop policy if exists "fotos do chat: enviar" on storage.objects;
create policy "fotos do chat: enviar" on storage.objects for insert to authenticated with check (bucket_id = 'chat' and public.pode_enviar_foto_chat(name));

-- Mensagens chegam na hora (Supabase Realtime)
do $$ begin
  alter publication supabase_realtime add table public.mensagens;
exception when others then null;   -- já adicionada ou Realtime indisponível: o site consulta de tempos em tempos
end $$;

-- ---------------------------------------------------------
-- Fotos do site (pasta pública "site"; só administradores enviam)
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;
drop policy if exists "fotos do site: leitura" on storage.objects;
create policy "fotos do site: leitura" on storage.objects for select using (bucket_id = 'site');
drop policy if exists "fotos do site: envio" on storage.objects;
create policy "fotos do site: envio" on storage.objects for insert to authenticated with check (bucket_id = 'site' and public.eh_admin());
drop policy if exists "fotos do site: troca" on storage.objects;
create policy "fotos do site: troca" on storage.objects for update to authenticated using (bucket_id = 'site' and public.eh_admin());
drop policy if exists "fotos do site: exclusão" on storage.objects;
create policy "fotos do site: exclusão" on storage.objects for delete to authenticated using (bucket_id = 'site' and public.eh_admin());

-- ---------------------------------------------------------
-- Permissões da API (a segurança de verdade vem das regras acima)
-- ---------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.categorias, public.servicos, public.configuracoes to anon, authenticated;
grant insert, update, delete on public.categorias, public.servicos, public.configuracoes to authenticated;
grant select, insert, update on public.clientes to authenticated;
grant select, delete on public.pedidos to authenticated;
grant select, insert, update, delete on public.equipe to authenticated;
grant select on public.mensagens to authenticated;
revoke execute on function public.criar_pedido(jsonb, text), public.atualizar_pedido(uuid, text, text),
  public.enviar_mensagem(uuid, text, text, text), public.marcar_lidas(uuid, text) from public, anon;
grant execute on function public.criar_pedido(jsonb, text), public.atualizar_pedido(uuid, text, text),
  public.enviar_mensagem(uuid, text, text, text), public.marcar_lidas(uuid, text),
  public.pode_ver_foto_chat(text), public.pode_enviar_foto_chat(text),
  public.meu_papel(), public.meu_nome_equipe(), public.eh_equipe(), public.eh_admin() to authenticated;
grant execute on function public.email_ja_cadastrado(text) to anon, authenticated;

-- ---------------------------------------------------------
-- Catálogo inicial (só entra se ainda não existir; depois edite pelo painel)
-- ---------------------------------------------------------
insert into public.categorias (id, ordem, ativo, dados) values ('limpa-nome', 1, true, '{"nome": "Limpa Nome", "descricao": "Negociação das suas dívidas para tirar seu CPF do Serasa, SPC e Boa Vista.", "icone": "aperto"}'::jsonb) on conflict (id) do nothing;
insert into public.categorias (id, ordem, ativo, dados) values ('bacen', 2, true, '{"nome": "Bacen", "descricao": "Regularização de apontamentos no Sistema de Informações de Crédito (SCR) do Banco Central — o “Registrato”. Dois métodos, conforme o seu caso.", "icone": "banco"}'::jsonb) on conflict (id) do nothing;
insert into public.categorias (id, ordem, ativo, dados) values ('negativacao-indevida', 3, true, '{"nome": "Negativação indevida", "descricao": "Dívida que você não fez, já paga, prescrita ou sem aviso prévio.", "icone": "balanca"}'::jsonb) on conflict (id) do nothing;
insert into public.categorias (id, ordem, ativo, dados) values ('juros-abusivos', 4, true, '{"nome": "Revisão de juros", "descricao": "Contratos com juros acima da média do mercado.", "icone": "doc"}'::jsonb) on conflict (id) do nothing;
insert into public.categorias (id, ordem, ativo, dados) values ('score', 5, true, '{"nome": "Score e crédito", "descricao": "Reconstrução do seu score e do acesso ao crédito.", "icone": "grafico"}'::jsonb) on conflict (id) do nothing;
insert into public.categorias (id, ordem, ativo, dados) values ('empresas', 6, true, '{"nome": "Empresas (CNPJ)", "descricao": "Protestos, dívidas bancárias e restrições no CNPJ.", "icone": "empresa"}'::jsonb) on conflict (id) do nothing;
insert into public.servicos (id, categoria, ordem, ativo, dados) values ('limpa-nome', 'limpa-nome', 1, true, '{"nome": "Limpa Nome", "resumo": "Negociamos suas dívidas diretamente com bancos, lojas e financeiras para buscar descontos, parcelas que cabem no bolso e a retirada do seu nome dos cadastros de inadimplentes.", "descricao": "Fazemos o levantamento completo das pendências no seu CPF, negociamos com cada credor e acompanhamos até a baixa da negativação.\nVocê aprova cada acordo antes de ele ser fechado.", "itens": ["Levantamento de todas as dívidas no seu CPF", "Negociação de descontos e parcelamento", "Acompanhamento até a baixa da negativação"], "preco": null, "aPartir": true, "prazo": "", "foto": "", "destaque": true}'::jsonb) on conflict (id) do nothing;
insert into public.servicos (id, categoria, ordem, ativo, dados) values ('bacen-administrativo', 'bacen', 1, true, '{"nome": "Bacen — Método administrativo", "resumo": "Contestação dos apontamentos diretamente com as instituições e o Banco Central, sem processo judicial.", "descricao": "Indicado quando o registro no SCR tem erro, está desatualizado ou a dívida já foi negociada.\nAnalisamos o seu Registrato, identificamos cada apontamento e fazemos as solicitações de correção pelos canais oficiais.", "itens": ["Análise completa do seu Registrato (SCR)", "Pedidos de correção junto às instituições", "Acompanhamento até a atualização do registro"], "preco": null, "aPartir": true, "prazo": "", "foto": "", "destaque": false}'::jsonb) on conflict (id) do nothing;
insert into public.servicos (id, categoria, ordem, ativo, dados) values ('bacen-judicial', 'bacen', 2, true, '{"nome": "Bacen — Método judicial", "resumo": "Quando a via administrativa não resolve, o caso segue com advogado parceiro para buscar a correção na Justiça.", "descricao": "Indicado para apontamentos indevidos que a instituição se recusa a corrigir.\nO processo é conduzido por advogado parceiro, e você recebe a explicação de custos e prazos por escrito antes de começar.", "itens": ["Avaliação jurídica do caso", "Ação conduzida por advogado parceiro", "Relatórios de andamento pela sua conta"], "preco": null, "aPartir": true, "prazo": "", "foto": "", "destaque": false}'::jsonb) on conflict (id) do nothing;
insert into public.servicos (id, categoria, ordem, ativo, dados) values ('negativacao-indevida', 'negativacao-indevida', 1, true, '{"nome": "Contestação de negativação indevida", "resumo": "Verificamos cada apontamento e buscamos a exclusão e, quando cabível, a reparação pelos danos.", "descricao": "Casos comuns: dívida que você não reconhece, já paga, prescrita (mais de 5 anos) ou incluída sem o aviso prévio exigido pelo Código de Defesa do Consumidor.", "itens": ["Análise de cada registro no Serasa, SPC e Boa Vista", "Contestação junto ao credor e aos órgãos", "Encaminhamento jurídico com advogado parceiro"], "preco": null, "aPartir": true, "prazo": "", "foto": "", "destaque": false}'::jsonb) on conflict (id) do nothing;
insert into public.servicos (id, categoria, ordem, ativo, dados) values ('revisao-juros', 'juros-abusivos', 1, true, '{"nome": "Revisão de juros e contratos", "resumo": "Analisamos o contrato e mostramos onde está o excesso, comparando com as taxas médias do Banco Central.", "descricao": "Financiamento de veículo, empréstimo consignado, crédito pessoal e cartão de crédito.", "itens": ["Cálculo comparado com as taxas do Banco Central", "Financiamento, consignado e cartão", "Orientação sobre renegociação ou revisão judicial"], "preco": null, "aPartir": true, "prazo": "", "foto": "", "destaque": false}'::jsonb) on conflict (id) do nothing;
insert into public.servicos (id, categoria, ordem, ativo, dados) values ('score-credito', 'score', 1, true, '{"nome": "Recuperação de score", "resumo": "Depois do nome limpo, orientamos você a atualizar o Cadastro Positivo, organizar as contas e reconstruir a confiança do mercado.", "descricao": "", "itens": ["Diagnóstico do que está segurando o seu score", "Plano de ação simples, passo a passo", "Orientação para voltar a ter crédito com segurança"], "preco": null, "aPartir": true, "prazo": "", "foto": "", "destaque": false}'::jsonb) on conflict (id) do nothing;
insert into public.servicos (id, categoria, ordem, ativo, dados) values ('empresas-cnpj', 'empresas', 1, true, '{"nome": "Regularização de CNPJ", "resumo": "Organizamos o passivo e negociamos para a empresa voltar a operar com crédito.", "descricao": "", "itens": ["Levantamento de protestos e restrições", "Negociação de dívidas bancárias e com fornecedores", "Certidões e regularização do CNPJ"], "preco": null, "aPartir": true, "prazo": "", "foto": "", "destaque": false}'::jsonb) on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- =========================================================
-- Administradora do painel: Milena Garbim.
-- Para liberar outra pessoa, use a aba Equipe do painel (ou rode esta linha com outro e-mail).
insert into public.equipe (email, papel, nome) values ('millenagarbim@gmail.com', 'admin', 'Milena Garbim')
on conflict (email) do update set papel = 'admin', nome = coalesce(public.equipe.nome, 'Milena Garbim');
-- =========================================================

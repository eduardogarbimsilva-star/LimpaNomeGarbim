-- =========================================================
-- E06e — Análise gratuita guiada
-- O cliente baixa os PRÓPRIOS relatórios gratuitos (Registrato, Serasa,
-- Boa Vista, Cenprot), envia os arquivos e a equipe devolve a análise.
-- Arquivos num cofre privado: só o próprio cliente e a equipe veem.
-- Só acrescenta. Desfazer: supabase/desfazer/e06e.sql
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
drop policy if exists "documentos: cliente envia na própria pasta" on storage.objects;
create policy "documentos: cliente envia na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "documentos: dono e equipe veem" on storage.objects;
create policy "documentos: dono e equipe veem" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_equipe()));

alter table public.consultas add column if not exists anexos jsonb not null default '[]'::jsonb;
alter table public.consultas add column if not exists observacao_cliente text check (length(observacao_cliente) <= 1000);
alter table public.consultas drop constraint if exists consultas_tipo_check;
alter table public.consultas add constraint consultas_tipo_check check (tipo in ('completa', 'restricoes', 'protestos', 'score', 'scr', 'documentos'));
alter table public.consulta_produtos drop constraint if exists consulta_produtos_tipo_check;
alter table public.consulta_produtos add constraint consulta_produtos_tipo_check check (tipo in ('completa', 'restricoes', 'protestos', 'score', 'scr', 'documentos'));

insert into public.consulta_produtos (id, tipo, nome, descricao, itens, prazo, ordem) values
  ('gratuita', 'documentos', 'Análise gratuita', 'Você baixa seus relatórios gratuitos, envia aqui e a Milena explica o que está pesando no seu nome.',
   array['Passo a passo para baixar seus relatórios', 'Registrato (Banco Central), Serasa, Boa Vista e protestos', 'Análise explicada e o melhor caminho'], 'Resposta em até 2 dias úteis', 0)
on conflict (id) do nothing;

-- grátis: aparece à venda sem preço
drop policy if exists "consulta à venda é pública" on public.consulta_produtos;
create policy "consulta à venda é pública" on public.consulta_produtos for select
  using ((ativo and (preco is not null or tipo = 'documentos') and public.modulo_ativo('consultas')) or public.eh_equipe());

create or replace function privado.nome_consulta(p_tipo text) returns text language sql immutable as $$
  select case p_tipo when 'completa' then 'consulta completa (restrições, protestos e score)'
    when 'restricoes' then 'dívidas negativadas (restrições)' when 'protestos' then 'protestos em cartório (Cenprot)'
    when 'score' then 'score de crédito' when 'scr' then 'dívidas e atrasos com bancos (Registrato/SCR do Banco Central)'
    when 'documentos' then 'análise dos relatórios enviados por você' else p_tipo end
$$;

-- Cliente envia os relatórios para a análise gratuita
create or replace function public.enviar_analise_gratuita(p_anexos jsonb, p_observacao text, p_aceite boolean)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_cli public.clientes; v_doc text; v_id uuid; v_num text; a text;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  if not public.modulo_ativo('consultas') or not exists (select 1 from public.consulta_produtos where id = 'gratuita' and ativo) then
    raise exception 'A análise gratuita está pausada no momento.'; end if;
  if not coalesce(p_aceite, false) then raise exception 'Para continuar, marque a autorização.'; end if;
  if jsonb_typeof(p_anexos) <> 'array' or jsonb_array_length(p_anexos) = 0 then raise exception 'Envie pelo menos um relatório (PDF ou foto).'; end if;
  if jsonb_array_length(p_anexos) > 8 then raise exception 'Envie no máximo 8 arquivos.'; end if;
  for a in select jsonb_array_elements_text(p_anexos) loop
    if split_part(a, '/', 1) <> auth.uid()::text then raise exception 'Arquivo inválido.'; end if;
  end loop;
  if exists (select 1 from public.consultas where cliente_id = auth.uid() and tipo = 'documentos' and status in ('autorizada', 'em_andamento')) then
    raise exception 'Você já tem uma análise gratuita em andamento. Aguarde a resposta da Milena.'; end if;
  select * into v_cli from public.clientes where id = auth.uid();
  v_doc := coalesce(nullif(v_cli.cpf, ''), nullif(v_cli.cnpj, ''));
  if v_doc is null then raise exception 'Complete seu cadastro (CPF ou CNPJ) em Minha conta antes de enviar.'; end if;
  v_num := 'AG-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));
  insert into public.consultas (cliente_id, tipo, finalidade, status, origem, produto_id, valor, pagamento_status, numero, modo, anexos, observacao_cliente,
    consentimento_em, consentimento_texto, respondido_em, solicitado_por)
  values (auth.uid(), 'documentos', 'Analisar os relatórios enviados pelo titular e orientar o melhor caminho', 'autorizada', 'cliente', 'gratuita', null, 'dispensado', v_num, 'manual',
    p_anexos, left(nullif(trim(p_observacao), ''), 1000), now(),
    'Eu, titular do documento ' || v_doc || ', envio meus próprios relatórios de crédito e autorizo Milena Garbim · Limpa Nome a analisá-los, somente para me orientar (' || v_num
      || '), conforme a Política de Privacidade e a LGPD (Lei 13.709/2018). Enviado em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI') || ' (horário de Brasília).',
    now(), public.meu_email())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.enviar_analise_gratuita(jsonb, text, boolean) from public, anon;
grant execute on function public.enviar_analise_gratuita(jsonb, text, boolean) to authenticated;

-- a análise gratuita entra na fila como "nova" para avisar a equipe
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
      'id', new.id, 'numero', coalesce(new.numero, ''), 'cliente_id', new.cliente_id, 'pedido_id', new.pedido_id, 'tipo', new.tipo,
      'produto', coalesce(v_nome, privado.nome_consulta(new.tipo)), 'valor', new.valor, 'origem', new.origem)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-evento-segredo', v_seg), timeout_milliseconds := 15000);
  return new;
exception when others then return new;
end $$;
-- resultado: só exige pagamento quando a consulta é paga (a gratuita é "dispensado")
create or replace function privado.consulta_paga() returns trigger
language plpgsql as $$
begin
  if new.status = 'concluida' and new.origem = 'cliente' and new.pagamento_status = 'pendente' then
    raise exception 'Confirme o pagamento antes de registrar o resultado.';
  end if;
  return new;
end $$;
notify pgrst, 'reload schema';

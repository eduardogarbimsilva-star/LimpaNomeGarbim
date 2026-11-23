-- =========================================================
-- E04 — Catálogo de produtos de crédito (portfólio Ditto)
-- 20 produtos entram como RASCUNHO, sem descrição, preço ou requisitos
-- inventados. Só aparecem no site quando: (1) parceria, autorização e
-- disponibilidade forem confirmadas, (2) o produto for publicado e
-- (3) o módulo "Produtos de crédito" estiver ligado.
-- Só acrescenta. Desfazer: supabase/desfazer/e04.sql
-- =========================================================
create table if not exists public.produtos_credito (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{2,40}$'),
  nome text not null check (length(nome) <= 100),
  perfil text not null check (perfil in ('clt', 'aposentado', 'servidor', 'autonomo', 'patrimonio', 'complementar')),
  pagina_portfolio int,
  pergunta_referencia text check (length(pergunta_referencia) <= 200),
  status text not null default 'rascunho' check (status in ('rascunho', 'revisao', 'publicado', 'arquivado')),
  parceria_confirmada boolean not null default false,
  autorizacao_verificada boolean not null default false,
  disponibilidade_verificada boolean not null default false,
  sensivel boolean not null default false,
  fornecedor text check (length(fornecedor) <= 120),
  descricao_comercial text check (length(descricao_comercial) <= 1500),
  preco text check (length(preco) <= 200),
  requisitos text[] not null default '{}',
  documentos text[] not null default '{}',
  fonte_oferta text check (length(fonte_oferta) <= 300),
  validade date,
  observacao text check (length(observacao) <= 600),
  ordem int not null default 0,
  publicado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
alter table public.produtos_credito enable row level security;
drop policy if exists "produto publicado é público" on public.produtos_credito;
create policy "produto publicado é público" on public.produtos_credito for select
  using ((status = 'publicado' and public.modulo_ativo('catalogo_ditto') and (validade is null or validade >= current_date)) or public.eh_equipe());
drop policy if exists "admin edita produtos" on public.produtos_credito;
create policy "admin edita produtos" on public.produtos_credito for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
grant select on public.produtos_credito to anon, authenticated;
grant update (status, parceria_confirmada, autorizacao_verificada, disponibilidade_verificada, fornecedor, descricao_comercial, preco, requisitos, documentos, fonte_oferta, validade, observacao, ordem) on public.produtos_credito to authenticated;
grant all on public.produtos_credito to service_role;

-- Regra de publicação garantida pelo banco
create or replace function privado.regras_produto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'publicado' then
    if not (new.parceria_confirmada and new.autorizacao_verificada and new.disponibilidade_verificada) then
      raise exception 'Para publicar, confirme parceria, autorização e disponibilidade em 2026.';
    end if;
    if coalesce(trim(new.descricao_comercial), '') = '' or coalesce(trim(new.fornecedor), '') = '' then
      raise exception 'Para publicar, preencha a descrição comercial e o fornecedor/parceiro.';
    end if;
    if new.validade is not null and new.validade < current_date then
      raise exception 'A validade da oferta já passou. Atualize antes de publicar.';
    end if;
    if old.status is distinct from 'publicado' then new.publicado_em := now(); end if;
  end if;
  new.atualizado_em := now();
  new.atualizado_por := coalesce(public.meu_email(), 'sistema');
  return new;
end $$;
drop trigger if exists produtos_regras on public.produtos_credito;
create trigger produtos_regras before update on public.produtos_credito for each row execute function privado.regras_produto();
drop trigger if exists produtos_credito_auditoria on public.produtos_credito;
create trigger produtos_credito_auditoria after insert or update or delete on public.produtos_credito for each row execute function privado.auditar();

-- O módulo "Produtos de crédito" passa a poder ser ligado (continua DESLIGADO)
update public.modulos set disponivel = true, etapa = null where id = 'catalogo_ditto';

-- 20 produtos do Portfólio Ditto (rascunho; sensível = exige validação específica de regras atuais)
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-01', 'Consignado Privado CLT', 'clt', 2, 'Você trabalha de carteira assinada?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 1) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-02', 'Antecipação do FGTS', 'clt', 2, 'Você tem saldo de FGTS parado?', true, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 2) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-03', 'Empréstimo no Cartão de Crédito', 'clt', 2, 'Você tem limite livre no cartão?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 3) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-04', 'Crédito Pessoal', 'clt', 2, 'Precisa de um valor sem desconto em folha?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 4) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-05', 'Empréstimo INSS', 'aposentado', 3, 'Você recebe aposentadoria ou pensão do INSS?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 5) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-06', 'Cartão RMC', 'aposentado', 3, 'Você ainda tem margem para cartão consignado?', true, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 6) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-07', 'Cartão RCC', 'aposentado', 3, 'Você já conhece o cartão benefício?', true, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 7) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-08', 'Portabilidade e Refinanciamento', 'aposentado', 3, 'Você já tem consignado em outro banco?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 8) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-09', 'SIAPE', 'servidor', 4, 'Você é servidor público federal?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 9) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-10', 'Prefeitura', 'servidor', 4, 'Você trabalha para a prefeitura da sua cidade?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 10) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-11', 'Convênio Público', 'servidor', 4, 'Você é servidor de um órgão conveniado?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 11) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-12', 'Empréstimo Bolsa Família', 'autonomo', 5, 'Você recebe o Bolsa Família?', true, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 12) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-13', 'Microcrédito', 'autonomo', 5, 'Você tem um pequeno negócio e quer crescer?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 13) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-14', 'Empréstimo na Conta de Luz', 'autonomo', 5, 'A conta de luz está no seu nome?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 14) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-15', 'Garantia de Veículo (Car Equity)', 'patrimonio', 6, 'Você tem carro no seu nome?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 15) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-16', 'Home Equity', 'patrimonio', 6, 'Você tem imóvel próprio?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 16) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-17', 'Financiamento Imobiliário', 'patrimonio', 6, 'Você quer comprar a casa própria?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 17) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-18', 'Saúde+', 'complementar', 7, 'Hoje você tem acesso a consultas e exames?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 18) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-19', 'Energia por Assinatura', 'complementar', 7, 'Quanto vem a sua conta de luz?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 19) on conflict (id) do nothing;
insert into public.produtos_credito (id, nome, perfil, pagina_portfolio, pergunta_referencia, sensivel, observacao, ordem) values ('DITTO-20', 'Indicação de Contas', 'complementar', 7, 'Você já tem conta digital?', false, 'Referência comercial do Portfólio Ditto; não presume parceria, autorização, elegibilidade ou oferta ativa.', 20) on conflict (id) do nothing;

notify pgrst, 'reload schema';

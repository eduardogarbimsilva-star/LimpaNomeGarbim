-- =========================================================
-- E06d — Textos das consultas fiéis às fontes da Direct Data
-- (Boa Vista para CPF, QUOD para CNPJ, protestos IEPTB/Cenprot, score QUOD).
-- Só altera produtos que ainda não estão à venda (não mexe no que a dona já publicou).
-- =========================================================
update public.consulta_produtos set
  descricao = 'Restrições, protestos e score em um só relatório, explicado em linguagem simples.',
  itens = array['Dívidas negativadas: Boa Vista (CPF) ou QUOD (CNPJ)', 'Protestos em cartório em todo o Brasil (Cenprot/IEPTB)', 'Score de crédito (QUOD)', 'Credor, valor e data de cada registro']
where id = 'completa' and not ativo;
update public.consulta_produtos set
  descricao = 'Veja se o seu CPF ou CNPJ tem dívidas negativadas e por quem.',
  itens = array['CPF: base Boa Vista', 'CNPJ: base QUOD', 'Credor, valor e data de cada registro']
where id = 'restricoes' and not ativo;
update public.consulta_produtos set
  descricao = 'Protestos registrados em cartórios de todo o Brasil (Central Nacional de Protesto).',
  itens = array['Cartório, cidade, valor e data', 'Todos os estados']
where id = 'protestos' and not ativo;
update public.consulta_produtos set
  descricao = 'Sua pontuação de crédito e a faixa de risco.',
  itens = array['Pontuação atual (QUOD)', 'Faixa de risco']
where id = 'score' and not ativo;
update public.consulta_produtos set
  descricao = 'Empréstimos, financiamentos e atrasos registrados no Banco Central (SCR). Feita pela equipe a partir do seu Registrato.',
  itens = array['Dívidas em dia e em atraso', 'Prejuízos registrados pelos bancos'], prazo = 'Resultado em até 2 dias úteis'
where id = 'scr' and not ativo;
create or replace function privado.nome_consulta(p_tipo text) returns text language sql immutable as $$
  select case p_tipo when 'completa' then 'consulta completa (restrições, protestos e score)'
    when 'restricoes' then 'dívidas negativadas (restrições)' when 'protestos' then 'protestos em cartório (Cenprot)'
    when 'score' then 'score de crédito' when 'scr' then 'dívidas e atrasos com bancos (Registrato/SCR do Banco Central)' else p_tipo end
$$;

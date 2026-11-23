-- =========================================================
-- E05 — Diagnóstico inteligente: regras versionadas
-- Só acrescenta. Desfazer: supabase/desfazer/e05.sql
-- =========================================================
create table if not exists public.diagnostico_regras (
  versao int primary key check (versao > 0),
  regras jsonb not null,
  nota text not null default '' check (length(nota) <= 300),
  ativo boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por text
);
create unique index if not exists diagnostico_uma_ativa on public.diagnostico_regras (ativo) where ativo;
alter table public.diagnostico_regras enable row level security;
drop policy if exists "regras ativas são públicas" on public.diagnostico_regras;
create policy "regras ativas são públicas" on public.diagnostico_regras for select using (ativo or public.eh_admin());
drop policy if exists "admin cria versão" on public.diagnostico_regras;
create policy "admin cria versão" on public.diagnostico_regras for insert to authenticated with check (public.eh_admin() and not ativo);
grant select on public.diagnostico_regras to anon, authenticated;
grant insert (versao, regras, nota) on public.diagnostico_regras to authenticated;
grant all on public.diagnostico_regras to service_role;

create or replace function privado.carimbar_diagnostico() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(jsonb_typeof(new.regras -> 'perguntas'), '') <> 'object' or coalesce(jsonb_typeof(new.regras -> 'resultados'), '') <> 'array' or coalesce(new.regras ->> 'inicio', '') = '' then
    raise exception 'Regras inválidas: faltam perguntas ou resultados.';
  end if;
  new.criado_em := now();
  new.criado_por := coalesce(public.meu_email(), 'sistema');
  return new;
end $$;
drop trigger if exists diagnostico_carimbo on public.diagnostico_regras;
create trigger diagnostico_carimbo before insert on public.diagnostico_regras for each row execute function privado.carimbar_diagnostico();
drop trigger if exists diagnostico_regras_auditoria on public.diagnostico_regras;
create trigger diagnostico_regras_auditoria after insert or update on public.diagnostico_regras for each row execute function privado.auditar();

-- Ativar uma versão (só administrador): desliga as outras na mesma operação
create or replace function public.ativar_diagnostico(p_versao int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Você não tem permissão para fazer isso.'; end if;
  if not exists (select 1 from public.diagnostico_regras where versao = p_versao) then raise exception 'Versão não encontrada.'; end if;
  update public.diagnostico_regras set ativo = false where ativo and versao <> p_versao;
  update public.diagnostico_regras set ativo = true where versao = p_versao;
end $$;
revoke all on function public.ativar_diagnostico(int) from public, anon;
grant execute on function public.ativar_diagnostico(int) to authenticated;

-- Versão 1 (ativa). O módulo "Diagnóstico inteligente" continua DESLIGADO até você ligar.
insert into public.diagnostico_regras (versao, regras, nota, ativo)
values (1, '{"nome": "Diagnóstico v1 — nome, crédito e contratos", "inicio": "perfil", "perguntas": {"perfil": {"texto": "Para quem é a ajuda?", "opcoes": [{"valor": "pf", "texto": "Para mim (CPF)", "ir": "situacao"}, {"valor": "pj", "texto": "Para a minha empresa (CNPJ)", "ir": "situacao"}]}, "situacao": {"texto": "O que está acontecendo hoje?", "opcoes": [{"valor": "restricao", "texto": "Estou negativado (SPC, Serasa, Boa Vista ou protesto)", "ir": "onde"}, {"valor": "indevida", "texto": "Apareceu uma dívida que não é minha ou que já paguei", "ir": "onde_indevida"}, {"valor": "limpo_negado", "texto": "Meu nome está limpo, mas o banco nega crédito", "ir": "banco"}, {"valor": "juros", "texto": "Pago juros altos em empréstimo, financiamento ou cartão", "ir": "contrato"}, {"valor": "score", "texto": "Quero melhorar o meu score", "ir": "fim"}, {"valor": "nsei", "texto": "Não sei direito o que está acontecendo", "ir": "fim"}]}, "onde": {"texto": "Onde aparece a restrição?", "opcoes": [{"valor": "biros", "texto": "SPC, Serasa ou Boa Vista", "ir": "reconhece"}, {"valor": "cartorio", "texto": "Protesto em cartório (Cenprot)", "ir": "reconhece"}, {"valor": "varios", "texto": "Em vários lugares", "ir": "reconhece"}, {"valor": "nsei", "texto": "Não sei", "ir": "reconhece"}]}, "onde_indevida": {"texto": "O que aconteceu com essa dívida?", "opcoes": [{"valor": "nao_minha", "texto": "Não reconheço: nunca contratei", "ir": "fim"}, {"valor": "paga", "texto": "Já paguei, mas continua no meu nome", "ir": "fim"}, {"valor": "valor_errado", "texto": "A dívida existe, mas o valor está errado", "ir": "fim"}, {"valor": "sem_aviso", "texto": "Fui negativado sem receber aviso antes", "ir": "fim"}]}, "reconhece": {"texto": "Você reconhece essa dívida?", "opcoes": [{"valor": "sim", "texto": "Sim, a dívida é minha", "ir": "tempo"}, {"valor": "nao", "texto": "Não, não é minha ou já paguei", "ir": "fim"}, {"valor": "parte", "texto": "Em parte: o valor parece errado", "ir": "tempo"}]}, "tempo": {"texto": "Há quanto tempo está negativado?", "opcoes": [{"valor": "recente", "texto": "Menos de 1 ano", "ir": "tentou"}, {"valor": "medio", "texto": "De 1 a 5 anos", "ir": "tentou"}, {"valor": "antigo", "texto": "Mais de 5 anos", "ir": "tentou"}, {"valor": "nsei", "texto": "Não sei", "ir": "tentou"}]}, "tentou": {"texto": "Você já tentou resolver?", "opcoes": [{"valor": "nao", "texto": "Ainda não", "ir": "fim"}, {"valor": "tentou", "texto": "Sim, mas não deu certo", "ir": "fim"}, {"valor": "negociando", "texto": "Estou negociando agora", "ir": "fim"}]}, "banco": {"texto": "Você tem ou já teve dívidas ou atrasos com bancos?", "opcoes": [{"valor": "scr", "texto": "Sim, dívidas antigas com bancos (prejuízo ou atraso)", "ir": "fim"}, {"valor": "sem_divida", "texto": "Não, mas mesmo assim o crédito é negado", "ir": "fim"}, {"valor": "nsei", "texto": "Não sei", "ir": "fim"}]}, "contrato": {"texto": "Que tipo de contrato?", "opcoes": [{"valor": "veiculo", "texto": "Financiamento de veículo", "ir": "fim"}, {"valor": "consignado", "texto": "Empréstimo consignado", "ir": "fim"}, {"valor": "cartao", "texto": "Cartão de crédito ou cheque especial", "ir": "fim"}, {"valor": "pessoal", "texto": "Empréstimo pessoal", "ir": "fim"}]}}, "resultados": [{"id": "indevida", "titulo": "Contestação de negativação indevida", "se": {"situacao": ["indevida"]}, "servicos": ["negativacao-indevida", "limpa-nome"], "explicacao": "Você contou que a dívida não é sua, já foi paga, está com valor errado ou foi registrada sem aviso. Nesses casos, a negativação pode ser contestada."}, {"id": "nao_reconhece", "titulo": "Contestação de negativação indevida", "se": {"reconhece": ["nao"]}, "servicos": ["negativacao-indevida", "limpa-nome"], "explicacao": "Você disse que não reconhece a dívida ou que ela já foi paga. Uma negativação assim pode ser contestada."}, {"id": "prazo_5_anos", "titulo": "Negativação com mais de 5 anos", "se": {"tempo": ["antigo"]}, "servicos": ["negativacao-indevida", "limpa-nome"], "explicacao": "Pelo Código de Defesa do Consumidor (art. 43, § 1º), o registro negativo não pode ficar mais de 5 anos no cadastro. Vale conferir se o seu ainda deveria estar lá."}, {"id": "empresa_restricao", "titulo": "Regularização de CNPJ", "se": {"perfil": ["pj"], "situacao": ["restricao"]}, "servicos": ["empresas-cnpj", "diagnostico-completo"], "explicacao": "Você indicou que a restrição está no CNPJ da empresa. O caminho começa pelo levantamento de protestos e restrições da empresa."}, {"id": "restricao", "titulo": "Limpa Nome", "se": {"situacao": ["restricao"]}, "servicos": ["limpa-nome", "diagnostico-completo"], "explicacao": "Você está com o nome negativado e reconhece a dívida, total ou parcialmente. O Limpa Nome trata a retirada das restrições; o diagnóstico mostra tudo o que existe no seu nome."}, {"id": "bacen_scr", "titulo": "Bacen (Registrato / SCR)", "se": {"banco": ["scr"]}, "servicos": ["bacen-administrativo", "bacen-judicial"], "explicacao": "Dívidas e atrasos com bancos ficam registrados no Sistema de Informações de Crédito do Banco Central (SCR), que os bancos consultam mesmo com o nome limpo. Há dois métodos para tratar isso; a análise indica qual cabe no seu caso."}, {"id": "limpo_negado", "titulo": "Rating bancário", "se": {"situacao": ["limpo_negado"]}, "servicos": ["rating-bancario", "diagnostico-completo"], "explicacao": "Com o nome limpo, o banco pode negar crédito pela nota interna (rating) e pelo histórico no Banco Central. O primeiro passo é entender o que está pesando."}, {"id": "juros", "titulo": "Revisão de juros e perícia de crédito", "se": {"situacao": ["juros"]}, "servicos": ["revisao-juros", "pericia-credito"], "explicacao": "Você contou que paga juros altos. A perícia compara o contrato com as taxas médias do Banco Central e mostra se houve cobrança acima do permitido."}, {"id": "score", "titulo": "Recuperação de score", "se": {"situacao": ["score"]}, "servicos": ["score-credito", "orientacao-financeira"], "explicacao": "Você quer melhorar o score. Um plano simples, com Cadastro Positivo e contas organizadas, ajuda a reconstruir a confiança do mercado."}, {"id": "padrao", "titulo": "Diagnóstico completo", "se": {}, "servicos": ["diagnostico-completo", "orientacao-financeira"], "explicacao": "Para entender o seu caso com segurança, o melhor começo é levantar o que existe no seu nome e explicar, em linguagem simples, o que pesa e por quê."}], "notas": [{"se": {"onde": ["cartorio", "varios"]}, "texto": "Protestos em cartório aparecem na Central Nacional de Protesto (Cenprot), e não só no SPC e Serasa. Eles também precisam ser tratados."}, {"se": {"situacao": ["indevida"], "onde_indevida": ["sem_aviso"]}, "texto": "O consumidor deve ser avisado por escrito antes de ser negativado (CDC, art. 43, § 2º)."}, {"se": {"onde_indevida": ["paga"]}, "texto": "Depois que a dívida é paga, o credor deve pedir a retirada do registro em até 5 dias úteis (entendimento do STJ, Súmula 548)."}, {"se": {"tentou": ["negociando"]}, "texto": "Antes de fechar um acordo, vale uma segunda opinião sobre valores e juros."}, {"se": {"tentou": ["tentou"]}, "texto": "Não desanime: com a abordagem certa, muitos casos que pareciam travados se resolvem."}, {"se": {"situacao": ["nsei"]}, "texto": "Você pode consultar de graça o Registrato, do Banco Central, para ver empréstimos e atrasos no seu CPF ou CNPJ."}]}'::jsonb, 'Versão inicial (E05)', true) on conflict (versao) do nothing;
update public.modulos set disponivel = true, etapa = null where id = 'diagnostico';
notify pgrst, 'reload schema';

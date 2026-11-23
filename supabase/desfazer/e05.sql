-- Desfaz a E05 (diagnóstico inteligente). O questionário antigo continua funcionando.
drop function if exists public.ativar_diagnostico(int);
drop table if exists public.diagnostico_regras;
drop function if exists privado.carimbar_diagnostico();
update public.modulos set disponivel = false, etapa = 'E05', ativo = false where id = 'diagnostico';
notify pgrst, 'reload schema';

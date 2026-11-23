-- Desfaz a E06c (consulta automática). Volta tudo para o modo manual.
update privado.ajustes set valor = '' where chave = 'consulta_provedor';
drop trigger if exists consultas_automatica on public.consultas;
drop function if exists privado.consulta_automatica();
drop function if exists public.definir_integracao_consulta(text, text);
drop function if exists public.situacao_integracao_consulta();
drop function if exists public.config_fornecedor_consulta();
drop function if exists public.reprocessar_consulta(uuid);
delete from privado.ajustes where chave in ('directd_token', 'relinq_token');
notify pgrst, 'reload schema';

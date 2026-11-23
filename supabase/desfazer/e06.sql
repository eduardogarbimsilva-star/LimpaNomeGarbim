-- Desfaz a E06 (central de consultas). Pedidos e mensagens não são tocados.
drop function if exists public.solicitar_consulta(uuid, text, text);
drop function if exists public.responder_consulta(uuid, boolean);
drop function if exists public.registrar_consulta(uuid, text, jsonb, text, date);
drop function if exists public.cancelar_consulta(uuid, text);
drop function if exists privado.nome_consulta(text);
drop table if exists public.consultas;
delete from privado.ajustes where chave = 'consulta_provedor';
update public.modulos set disponivel = false, etapa = 'E06', ativo = false where id = 'consultas';
notify pgrst, 'reload schema';

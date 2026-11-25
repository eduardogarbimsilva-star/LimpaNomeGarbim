-- Desfaz a E08 (pagamento automático Asaas). Volta para o PIX com confirmação manual.
drop function if exists public.pagamento_automatico();
drop function if exists public.situacao_gateway();
drop function if exists public.desligar_gateway();
drop function if exists public.config_gateway();
drop function if exists public.salvar_gateway(text, text, text, text, text);
drop function if exists public.pagamento_gateway_confirmado(uuid, text, numeric);
drop function if exists public.pagamento_gateway_estornado(text);
drop index if exists public.consultas_gateway_id;
alter table public.consultas drop column if exists gateway_id, drop column if exists pix_copia, drop column if exists pix_expira;
delete from privado.ajustes where chave in ('gateway', 'asaas_ambiente', 'asaas_chave', 'asaas_webhook_token');
notify pgrst, 'reload schema';

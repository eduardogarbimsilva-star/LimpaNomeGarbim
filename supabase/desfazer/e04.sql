-- Desfaz a E04 (produtos de crédito). Não toca no catálogo de serviços nem em pedidos.
drop table if exists public.produtos_credito;
drop function if exists privado.regras_produto();
update public.modulos set disponivel = false, etapa = 'E04', ativo = false where id = 'catalogo_ditto';
notify pgrst, 'reload schema';

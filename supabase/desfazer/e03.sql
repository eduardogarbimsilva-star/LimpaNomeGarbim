-- Desfaz a E03 (módulos + histórico). Os dados de pedidos, clientes e catálogo não são tocados.
drop trigger if exists pedidos_modulos on public.pedidos;
drop trigger if exists mensagens_modulos on public.mensagens;
drop trigger if exists pedidos_auditoria on public.pedidos;
do $$ declare t text; begin
  foreach t in array array['configuracoes', 'categorias', 'servicos', 'equipe', 'modulos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
  end loop;
end $$;
drop function if exists privado.exigir_modulos();
drop function if exists privado.auditar();
drop function if exists privado.diferenca(jsonb, jsonb, int);
drop table if exists public.auditoria;
drop table if exists public.modulos;
drop function if exists privado.proteger_modulo();
drop function if exists public.modulo_ativo(text);
notify pgrst, 'reload schema';

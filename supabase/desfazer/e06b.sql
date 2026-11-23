-- Desfaz a E06b (autoatendimento de consultas). Mantém a central da E06.
drop trigger if exists consultas_evento on public.consultas;
drop trigger if exists consultas_paga on public.consultas;
drop function if exists privado.avisar_consulta();
drop function if exists privado.consulta_paga();
drop function if exists public.comprar_consulta(text, boolean);
drop function if exists public.informar_pagamento_consulta(uuid);
drop function if exists public.confirmar_pagamento_consulta(uuid);
delete from public.consultas where origem = 'cliente';
alter table public.consultas drop constraint if exists consultas_status_check;
alter table public.consultas add constraint consultas_status_check check (status in ('aguardando_autorizacao', 'autorizada', 'em_andamento', 'concluida', 'recusada', 'falhou', 'cancelada'));
alter table public.consultas drop column if exists origem, drop column if exists produto_id, drop column if exists valor, drop column if exists pagamento_status,
  drop column if exists pagamento_ref, drop column if exists pagamento_meio, drop column if exists informou_pago_em, drop column if exists pago_em, drop column if exists numero;
drop table if exists public.consulta_produtos;
notify pgrst, 'reload schema';

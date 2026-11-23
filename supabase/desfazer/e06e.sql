-- Desfaz a E06e (análise gratuita guiada). Os arquivos enviados continuam no cofre até serem apagados no Supabase.
drop function if exists public.enviar_analise_gratuita(jsonb, text, boolean);
delete from public.consultas where tipo = 'documentos';
delete from public.consulta_produtos where id = 'gratuita';
alter table public.consultas drop constraint if exists consultas_tipo_check;
alter table public.consultas add constraint consultas_tipo_check check (tipo in ('completa', 'restricoes', 'protestos', 'score', 'scr'));
alter table public.consulta_produtos drop constraint if exists consulta_produtos_tipo_check;
alter table public.consulta_produtos add constraint consulta_produtos_tipo_check check (tipo in ('completa', 'restricoes', 'protestos', 'score', 'scr'));
alter table public.consultas drop column if exists anexos, drop column if exists observacao_cliente;
drop policy if exists "documentos: cliente envia na própria pasta" on storage.objects;
drop policy if exists "documentos: dono e equipe veem" on storage.objects;
notify pgrst, 'reload schema';

-- =====================================================================
-- Delicia China · Seguimiento del pedido por parte del cliente
--
-- Ejecutar en el SQL Editor de Supabase (una sola vez) si ya corriste
-- 01-esquema.sql antes de este cambio. En instalaciones nuevas ya viene
-- incluido en 01-esquema.sql y no hace falta.
--
-- El cliente no puede leer la tabla de pedidos (RLS). Esta función le
-- devuelve solo el estado de SU pedido, buscándolo por el id (uuid) que
-- recibió al crearlo. Ese id es imposible de adivinar.
-- =====================================================================

create or replace function public.estado_pedido(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'codigo', p.codigo,
    'estado', p.estado,
    'tipo_entrega', p.tipo_entrega,
    'motivo_rechazo', p.motivo_rechazo,
    'actualizado_en', p.actualizado_en
  )
  from public.pedidos p
  where p.id = p_id;
$$;

revoke all on function public.estado_pedido(uuid) from public;
grant execute on function public.estado_pedido(uuid) to anon, authenticated;

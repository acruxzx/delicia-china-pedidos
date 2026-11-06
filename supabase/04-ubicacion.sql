-- =====================================================================
-- Delicia China · Ubicación del domicilio
--
-- Ejecutar en el SQL Editor de Supabase (una sola vez) si ya tenías la
-- base de datos creada antes de este cambio. En instalaciones nuevas ya
-- viene incluido en 01-esquema.sql y no hace falta.
--
-- Agrega la ubicación opcional que el cliente comparte al pedir y la
-- borra sola a los 7 días.
-- =====================================================================

alter table public.pedidos
  add column if not exists ubicacion_lat double precision check (ubicacion_lat between -90 and 90),
  add column if not exists ubicacion_lng double precision check (ubicacion_lng between -180 and 180),
  add column if not exists ubicacion_precision_m int check (ubicacion_precision_m >= 0);

-- La función cambia de parámetros: se borra la versión anterior para no dejar dos.
drop function if exists public.crear_pedido(text, text, text, text, text, text, text, jsonb);

create or replace function public.crear_pedido(
  p_cliente_nombre   text,
  p_cliente_telefono text,
  p_tipo_entrega     text,
  p_direccion        text,
  p_notas            text,
  p_metodo_pago      text,
  p_comprobante_path text,
  p_items            jsonb,  -- [{ "plato_id": 12, "cantidad": 2, "opciones": ["Sin cebolla"], "nota": "" }]
  p_lat              double precision default null,  -- ubicación opcional del domicilio
  p_lng              double precision default null,
  p_precision_m      int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_item   jsonb;
  v_plato  public.platos%rowtype;
  v_cant   int;
  v_total  int := 0;
begin
  if not coalesce((select c.recibiendo_pedidos from public.configuracion c where c.id = 1), false) then
    raise exception 'El restaurante no está recibiendo pedidos en este momento.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido está vacío.';
  end if;

  if jsonb_array_length(p_items) > 40 then
    raise exception 'El pedido tiene demasiados productos.';
  end if;

  if p_cliente_telefono is null or p_cliente_telefono !~ '^[0-9]{10}$' then
    raise exception 'Escribe un celular de 10 dígitos.';
  end if;

  if p_tipo_entrega = 'domicilio' and length(trim(coalesce(p_direccion, ''))) < 5 then
    raise exception 'Escribe la dirección de entrega.';
  end if;

  if p_comprobante_path is null or p_comprobante_path !~ '^pendientes/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then
    raise exception 'Falta el comprobante de pago.';
  end if;

  if (p_lat is null) <> (p_lng is null)
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'La ubicación no es válida. Vuelve a marcarla o envía el pedido solo con la dirección.';
  end if;

  -- Privacidad: las ubicaciones de pedidos de hace más de 7 días se borran.
  update public.pedidos
     set ubicacion_lat = null, ubicacion_lng = null, ubicacion_precision_m = null
   where ubicacion_lat is not null and creado_en < now() - interval '7 days';

  insert into public.pedidos (
    cliente_nombre, cliente_telefono, tipo_entrega, direccion, notas,
    metodo_pago, comprobante_path, ubicacion_lat, ubicacion_lng, ubicacion_precision_m
  ) values (
    trim(p_cliente_nombre), p_cliente_telefono, p_tipo_entrega,
    case when p_tipo_entrega = 'domicilio' then trim(p_direccion) end,
    nullif(trim(p_notas), ''), p_metodo_pago, p_comprobante_path,
    case when p_tipo_entrega = 'domicilio' then p_lat end,
    case when p_tipo_entrega = 'domicilio' then p_lng end,
    case when p_tipo_entrega = 'domicilio' and p_lat is not null then greatest(0, p_precision_m) end
  )
  returning * into v_pedido;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select pl.* into v_plato
    from public.platos pl
    where pl.id = (v_item ->> 'plato_id')::int and pl.disponible;

    if not found then
      raise exception 'Uno de los platos ya no está disponible.';
    end if;

    v_cant := coalesce((v_item ->> 'cantidad')::int, 0);
    if v_cant < 1 or v_cant > 50 then
      raise exception 'Cantidad no válida para %.', v_plato.nombre;
    end if;

    insert into public.pedido_items (pedido_id, plato_id, nombre, precio_unitario, cantidad, opciones, nota)
    values (
      v_pedido.id, v_plato.id, v_plato.nombre, v_plato.precio, v_cant,
      coalesce(array(select jsonb_array_elements_text(
        case when jsonb_typeof(v_item -> 'opciones') = 'array' then v_item -> 'opciones' else '[]'::jsonb end
      )), '{}'),
      nullif(trim(v_item ->> 'nota'), '')
    );

    v_total := v_total + v_plato.precio * v_cant;
  end loop;

  update public.pedidos set total = v_total where id = v_pedido.id;

  return jsonb_build_object('id', v_pedido.id, 'codigo', v_pedido.codigo, 'total', v_total);
end $$;

revoke all on function public.crear_pedido(text, text, text, text, text, text, text, jsonb, double precision, double precision, int) from public;
grant execute on function public.crear_pedido(text, text, text, text, text, text, text, jsonb, double precision, double precision, int) to anon, authenticated;

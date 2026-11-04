-- =====================================================================
-- Delicia China · Piloto de pedidos
-- Esquema de la base de datos para Supabase (plan gratuito).
--
-- Cómo usarlo: en el panel de Supabase abre "SQL Editor", pega este
-- archivo completo y pulsa "Run". Después ejecuta 02-datos-ejemplo.sql.
--
-- Roles de Supabase:
--   anon          = cualquier visitante de la web (el cliente).
--   authenticated = personal del restaurante que inició sesión en el panel.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Menú
-- ---------------------------------------------------------------------

create table public.categorias (
  id      serial primary key,
  nombre  text not null unique,
  orden   int  not null default 0,
  activa  boolean not null default true
);

create table public.platos (
  id            serial primary key,
  categoria_id  int  not null references public.categorias(id) on delete restrict,
  nombre        text not null,
  descripcion   text not null default '',
  precio        int  not null check (precio >= 0),   -- pesos colombianos, sin decimales
  disponible    boolean not null default true,       -- "agotado hoy" = false
  orden         int  not null default 0,
  imagen_url    text
);

create index platos_categoria_idx on public.platos (categoria_id, orden);


-- ---------------------------------------------------------------------
-- 2. Configuración del restaurante (una sola fila, id = 1)
-- ---------------------------------------------------------------------

create table public.configuracion (
  id                  int primary key default 1 check (id = 1),
  recibiendo_pedidos  boolean not null default true,  -- botón abrir/cerrar del panel
  horario_texto       text not null default '',
  whatsapp_tienda     text not null default '',        -- formato 57XXXXXXXXXX
  datos_pago          jsonb not null default '[]',     -- [{ "metodo": "nequi", "titular": "...", "numero": "..." }]
  opciones_generales  text[] not null default '{}',    -- "Sin cebolla", "Salsa aparte", ...
  actualizado_en      timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. Pedidos
-- ---------------------------------------------------------------------

create table public.pedidos (
  id                uuid primary key default gen_random_uuid(),
  codigo            int generated always as identity unique,  -- número corto para hablar con el cliente
  cliente_nombre    text not null check (length(trim(cliente_nombre)) between 2 and 80),
  cliente_telefono  text not null check (cliente_telefono ~ '^[0-9]{10}$'),
  tipo_entrega      text not null check (tipo_entrega in ('domicilio', 'recoger')),
  direccion         text,
  notas             text check (length(notas) <= 500),
  metodo_pago       text not null check (metodo_pago in ('nequi', 'daviplata', 'transferencia')),
  comprobante_path  text not null,           -- ruta del pantallazo en el bucket "comprobantes"
  total             int  not null default 0, -- calculado en el servidor, sin domicilio
  estado            text not null default 'pago_por_revisar' check (estado in (
                      'pago_por_revisar',
                      'en_preparacion',      -- aprobado
                      'en_camino',           -- solo domicilio
                      'listo_para_recoger',  -- solo recoger
                      'entregado',
                      'rechazado')),
  motivo_rechazo    text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint direccion_si_domicilio check (
    tipo_entrega = 'recoger' or length(trim(coalesce(direccion, ''))) >= 5
  )
);

create index pedidos_estado_idx on public.pedidos (estado, creado_en desc);

create table public.pedido_items (
  id               serial primary key,
  pedido_id        uuid not null references public.pedidos(id) on delete cascade,
  plato_id         int  references public.platos(id) on delete set null,
  nombre           text not null,   -- copia del nombre al momento del pedido
  precio_unitario  int  not null,   -- copia del precio al momento del pedido
  cantidad         int  not null check (cantidad between 1 and 50),
  opciones         text[] not null default '{}',
  nota             text check (length(nota) <= 200)
);

create index pedido_items_pedido_idx on public.pedido_items (pedido_id);

-- Mantiene actualizado_en al día.
create or replace function public.tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

create trigger pedidos_actualizado before update on public.pedidos
  for each row execute function public.tocar_actualizado();

create trigger configuracion_actualizado before update on public.configuracion
  for each row execute function public.tocar_actualizado();


-- ---------------------------------------------------------------------
-- 4. Crear pedido (lo llama la web del cliente)
--    El total se calcula aquí con los precios de la base de datos,
--    así nadie puede cambiar precios desde el navegador.
-- ---------------------------------------------------------------------

create or replace function public.crear_pedido(
  p_cliente_nombre   text,
  p_cliente_telefono text,
  p_tipo_entrega     text,
  p_direccion        text,
  p_notas            text,
  p_metodo_pago      text,
  p_comprobante_path text,
  p_items            jsonb   -- [{ "plato_id": 12, "cantidad": 2, "opciones": ["Sin cebolla"], "nota": "" }]
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

  insert into public.pedidos (
    cliente_nombre, cliente_telefono, tipo_entrega, direccion, notas,
    metodo_pago, comprobante_path
  ) values (
    trim(p_cliente_nombre), p_cliente_telefono, p_tipo_entrega,
    case when p_tipo_entrega = 'domicilio' then trim(p_direccion) end,
    nullif(trim(p_notas), ''), p_metodo_pago, p_comprobante_path
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

revoke all on function public.crear_pedido(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.crear_pedido(text, text, text, text, text, text, text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. Seguridad por filas (RLS)
-- ---------------------------------------------------------------------

alter table public.categorias    enable row level security;
alter table public.platos        enable row level security;
alter table public.configuracion enable row level security;
alter table public.pedidos       enable row level security;
alter table public.pedido_items  enable row level security;

-- El cliente puede leer el menú y el estado de la tienda.
create policy "menu visible" on public.categorias
  for select to anon, authenticated using (true);
create policy "platos visibles" on public.platos
  for select to anon, authenticated using (true);
create policy "configuracion visible" on public.configuracion
  for select to anon, authenticated using (true);

-- El personal del restaurante administra todo.
create policy "personal edita categorias" on public.categorias
  for all to authenticated using (true) with check (true);
create policy "personal edita platos" on public.platos
  for all to authenticated using (true) with check (true);
create policy "personal edita configuracion" on public.configuracion
  for update to authenticated using (true) with check (true);
create policy "personal ve pedidos" on public.pedidos
  for select to authenticated using (true);
create policy "personal actualiza pedidos" on public.pedidos
  for update to authenticated using (true) with check (true);
create policy "personal ve items" on public.pedido_items
  for select to authenticated using (true);

-- Los clientes NO leen ni escriben pedidos directamente:
-- solo pueden crearlos con la función crear_pedido.


-- ---------------------------------------------------------------------
-- 6. Comprobantes de pago (Storage)
--    Bucket privado: el cliente solo puede subir; el personal puede ver.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "cliente sube comprobante" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = 'pendientes');

create policy "personal ve comprobantes" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes');


-- ---------------------------------------------------------------------
-- 7. Tiempo real: el panel escucha los pedidos nuevos (alerta sonora)
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.pedidos;

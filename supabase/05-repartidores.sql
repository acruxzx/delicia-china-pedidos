-- =====================================================================
-- Delicia China · Roles del equipo y repartidores
--
-- Ejecutar en el SQL Editor de Supabase (una sola vez). Es necesario
-- en todas las instalaciones: va después de 01, 02 (y 03, 04 si tu base
-- es anterior a esos cambios).
--
-- Qué agrega:
--   - Perfiles con rol: "personal" (usa el panel) o "repartidor" (usa /repartidor).
--     Los usuarios que ya existían quedan como personal.
--     Los usuarios nuevos quedan SIN acceso hasta que alguien del personal
--     les asigne un rol desde el panel (botón "Equipo").
--   - Estado "esperando_repartidor": el pedido está listo y espera quien lo lleve.
--   - Repartidor del pedido, hora de salida y de entrega, costo del domicilio.
--   - Permisos: el panel queda solo para el personal; los repartidores
--     solo ven los pedidos que pueden llevar, a través de funciones.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Perfiles y roles
-- ---------------------------------------------------------------------

create table if not exists public.perfiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null default '' check (length(nombre) <= 60),
  rol        text check (rol in ('personal', 'repartidor')),  -- null = sin acceso
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where user_id = auth.uid() and activo;
$$;

create or replace function public.es_personal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.mi_rol() = 'personal', false);
$$;

create or replace function public.es_repartidor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.mi_rol() = 'repartidor', false);
$$;

-- Quienes ya usaban el panel quedan como personal.
insert into public.perfiles (user_id, nombre, rol)
select u.id, split_part(coalesce(u.email, ''), '@', 1), 'personal'
from auth.users u
on conflict (user_id) do nothing;

-- Usuarios nuevos: sin acceso, salvo el primero de todos (para no quedar por fuera).
create or replace function public.nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (user_id, nombre, rol)
  values (
    new.id,
    split_part(coalesce(new.email, ''), '@', 1),
    case when exists (select 1 from public.perfiles where rol = 'personal') then null else 'personal' end
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- Cada quien ve su perfil; el personal ve todos.
drop policy if exists "ver mi perfil" on public.perfiles;
create policy "ver mi perfil" on public.perfiles
  for select to authenticated using (user_id = auth.uid() or public.es_personal());

-- Equipo: lista de usuarios con su rol (solo personal).
create or replace function public.listar_equipo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Solo el personal puede ver el equipo.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', u.id,
      'correo', u.email,
      'nombre', coalesce(p.nombre, ''),
      'rol', p.rol,
      'activo', coalesce(p.activo, true),
      'yo', u.id = auth.uid()
    ) order by p.rol nulls first, p.nombre)
    from auth.users u
    left join public.perfiles p on p.user_id = u.id
  ), '[]'::jsonb);
end $$;

create or replace function public.guardar_perfil(p_user_id uuid, p_nombre text, p_rol text, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Solo el personal puede cambiar el equipo.';
  end if;
  if p_rol is not null and p_rol not in ('personal', 'repartidor') then
    raise exception 'Rol no válido.';
  end if;
  if p_user_id = auth.uid() and (p_rol is distinct from 'personal' or not p_activo) then
    raise exception 'No puedes quitarte tu propio acceso al panel.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Ese usuario no existe.';
  end if;
  insert into public.perfiles (user_id, nombre, rol, activo)
  values (p_user_id, left(trim(coalesce(p_nombre, '')), 60), p_rol, coalesce(p_activo, true))
  on conflict (user_id) do update
    set nombre = excluded.nombre, rol = excluded.rol, activo = excluded.activo;
end $$;


-- ---------------------------------------------------------------------
-- 2. Pedidos: repartidor, tiempos y nuevo estado
-- ---------------------------------------------------------------------

alter table public.pedidos
  add column if not exists repartidor_id   uuid references auth.users(id) on delete set null,
  add column if not exists salio_en        timestamptz,
  add column if not exists entregado_en    timestamptz,
  add column if not exists costo_domicilio int check (costo_domicilio >= 0);

alter table public.pedidos drop constraint if exists pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check check (estado in (
  'pago_por_revisar',
  'en_preparacion',
  'esperando_repartidor',  -- listo, esperando quien lo lleve (solo domicilio)
  'en_camino',
  'listo_para_recoger',
  'entregado',
  'rechazado'
));

create index if not exists pedidos_repartidor_idx on public.pedidos (repartidor_id, estado);

-- Hora de salida y de entrega, sin importar quién cambie el estado.
create or replace function public.marcar_tiempos()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'en_camino' and old.estado is distinct from 'en_camino' then
    new.salio_en := coalesce(new.salio_en, now());
  end if;
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    new.entregado_en := now();
  end if;
  if new.estado in ('pago_por_revisar', 'en_preparacion', 'esperando_repartidor') then
    new.salio_en := null;
  end if;
  return new;
end $$;

drop trigger if exists pedidos_tiempos on public.pedidos;
create trigger pedidos_tiempos before update on public.pedidos
  for each row execute function public.marcar_tiempos();


-- ---------------------------------------------------------------------
-- 3. Permisos: el panel y los comprobantes, solo para el personal
-- ---------------------------------------------------------------------

drop policy if exists "personal edita categorias" on public.categorias;
create policy "personal edita categorias" on public.categorias
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

drop policy if exists "personal edita platos" on public.platos;
create policy "personal edita platos" on public.platos
  for all to authenticated using (public.es_personal()) with check (public.es_personal());

drop policy if exists "personal edita configuracion" on public.configuracion;
create policy "personal edita configuracion" on public.configuracion
  for update to authenticated using (public.es_personal()) with check (public.es_personal());

drop policy if exists "personal ve pedidos" on public.pedidos;
create policy "personal ve pedidos" on public.pedidos
  for select to authenticated using (public.es_personal());

drop policy if exists "personal actualiza pedidos" on public.pedidos;
create policy "personal actualiza pedidos" on public.pedidos
  for update to authenticated using (public.es_personal()) with check (public.es_personal());

drop policy if exists "personal ve items" on public.pedido_items;
create policy "personal ve items" on public.pedido_items
  for select to authenticated using (public.es_personal());

drop policy if exists "personal ve comprobantes" on storage.objects;
create policy "personal ve comprobantes" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes' and public.es_personal());


-- ---------------------------------------------------------------------
-- 4. Funciones del repartidor
-- ---------------------------------------------------------------------

-- Pedidos que el repartidor puede llevar, los que lleva y los que entregó hoy.
create or replace function public.pedidos_repartidor()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_repartidor() then
    raise exception 'Tu usuario no tiene acceso de repartidor.';
  end if;
  return coalesce((
    select jsonb_agg(x.fila order by x.orden, x.creado_en)
    from (
      select
        p.creado_en,
        case p.estado when 'en_camino' then 0 when 'esperando_repartidor' then 1 else 2 end as orden,
        jsonb_build_object(
          'id', p.id,
          'codigo', p.codigo,
          'cliente_nombre', p.cliente_nombre,
          'cliente_telefono', p.cliente_telefono,
          'direccion', p.direccion,
          'notas', p.notas,
          'total', p.total,
          'metodo_pago', p.metodo_pago,
          'costo_domicilio', p.costo_domicilio,
          'estado', p.estado,
          'mio', coalesce(p.repartidor_id = auth.uid(), false),
          'asignado', p.repartidor_id is not null,
          'ubicacion_lat', p.ubicacion_lat,
          'ubicacion_lng', p.ubicacion_lng,
          'ubicacion_precision_m', p.ubicacion_precision_m,
          'creado_en', p.creado_en,
          'salio_en', p.salio_en,
          'entregado_en', p.entregado_en,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'opciones', i.opciones, 'nota', i.nota) order by i.id)
            from public.pedido_items i where i.pedido_id = p.id
          ), '[]'::jsonb)
        ) as fila
      from public.pedidos p
      where p.tipo_entrega = 'domicilio'
        and (
          (p.estado = 'esperando_repartidor' and (p.repartidor_id is null or p.repartidor_id = auth.uid()))
          or (p.estado = 'en_camino' and p.repartidor_id = auth.uid())
          or (p.estado = 'entregado' and p.repartidor_id = auth.uid() and p.entregado_en > now() - interval '12 hours')
        )
    ) x
  ), '[]'::jsonb);
end $$;

-- "Salir con el pedido": lo toma y lo marca en camino. Si otro ya salió con él, falla.
create or replace function public.salir_con_pedido(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_repartidor() then
    raise exception 'Tu usuario no tiene acceso de repartidor.';
  end if;
  update public.pedidos
     set repartidor_id = auth.uid(), estado = 'en_camino'
   where id = p_id
     and estado = 'esperando_repartidor'
     and (repartidor_id is null or repartidor_id = auth.uid());
  if not found then
    raise exception 'Este pedido ya lo tomó otro repartidor o ya no está listo para salir.';
  end if;
end $$;

create or replace function public.marcar_entregado(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_repartidor() then
    raise exception 'Tu usuario no tiene acceso de repartidor.';
  end if;
  update public.pedidos
     set estado = 'entregado'
   where id = p_id and repartidor_id = auth.uid() and estado = 'en_camino';
  if not found then
    raise exception 'Este pedido ya no está a tu nombre.';
  end if;
end $$;

-- "No puedo llevarlo": vuelve a quedar disponible para otro repartidor.
create or replace function public.liberar_pedido(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_repartidor() then
    raise exception 'Tu usuario no tiene acceso de repartidor.';
  end if;
  update public.pedidos
     set repartidor_id = null, estado = 'esperando_repartidor'
   where id = p_id and repartidor_id = auth.uid() and estado in ('esperando_repartidor', 'en_camino');
  if not found then
    raise exception 'Este pedido ya no está a tu nombre.';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 5. Seguimiento del cliente: nombre del repartidor
-- ---------------------------------------------------------------------

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
    'repartidor', case when p.estado in ('en_camino', 'entregado') then nullif(r.nombre, '') end,
    'actualizado_en', p.actualizado_en
  )
  from public.pedidos p
  left join public.perfiles r on r.user_id = p.repartidor_id
  where p.id = p_id;
$$;


-- ---------------------------------------------------------------------
-- 6. Quién puede llamar cada función
-- ---------------------------------------------------------------------

revoke all on function public.mi_rol() from public;
revoke all on function public.es_personal() from public;
revoke all on function public.es_repartidor() from public;
revoke all on function public.listar_equipo() from public;
revoke all on function public.guardar_perfil(uuid, text, text, boolean) from public;
revoke all on function public.pedidos_repartidor() from public;
revoke all on function public.salir_con_pedido(uuid) from public;
revoke all on function public.marcar_entregado(uuid) from public;
revoke all on function public.liberar_pedido(uuid) from public;
revoke all on function public.estado_pedido(uuid) from public;
revoke all on function public.nuevo_usuario() from public;

grant execute on function public.mi_rol() to authenticated;
grant execute on function public.es_personal() to authenticated;
grant execute on function public.es_repartidor() to authenticated;
grant execute on function public.listar_equipo() to authenticated;
grant execute on function public.guardar_perfil(uuid, text, text, boolean) to authenticated;
grant execute on function public.pedidos_repartidor() to authenticated;
grant execute on function public.salir_con_pedido(uuid) to authenticated;
grant execute on function public.marcar_entregado(uuid) to authenticated;
grant execute on function public.liberar_pedido(uuid) to authenticated;
grant execute on function public.estado_pedido(uuid) to anon, authenticated;

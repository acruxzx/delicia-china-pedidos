// Datos de la app del repartidor. Con Supabase usa funciones seguras de la base de datos
// (el repartidor no puede leer ni cambiar la tabla de pedidos directamente).
// Sin Supabase usa el almacén demo del navegador.

import { obtenerSupabase, supabaseConfigurado } from './datos.js';
import { actualizarPedidoDemo, escucharDemo, leerEquipoDemo, leerPedidosDemo } from './demo.js';

export const modoDemo = () => !supabaseConfigurado();

const CLAVE_DEMO = 'delicia-china:demo-repartidor';

/* ---------- Sesión ---------- */

// Devuelve { id, nombre, rol } o null si no hay sesión.
export async function sesion() {
  if (modoDemo()) {
    let id = null;
    try {
      id = localStorage.getItem(CLAVE_DEMO);
    } catch {
      /* sin almacenamiento */
    }
    const p = leerEquipoDemo().find((x) => x.user_id === id && x.activo);
    return p ? { id: p.user_id, nombre: p.nombre || p.correo, rol: p.rol } : null;
  }
  const sb = await obtenerSupabase();
  const { data } = await sb.auth.getSession();
  const usuario = data.session?.user;
  if (!usuario) return null;
  const { data: perfil, error } = await sb.from('perfiles').select('nombre, rol, activo').eq('user_id', usuario.id).maybeSingle();
  if (error) {
    console.error(error);
    throw new Error('No se pudo leer tu perfil. Si es la primera vez, falta ejecutar 05-repartidores.sql en Supabase.');
  }
  return {
    id: usuario.id,
    nombre: perfil?.nombre || usuario.email?.split('@')[0] || 'Repartidor',
    rol: perfil?.activo ? perfil.rol : null,
  };
}

export function repartidoresDemo() {
  return leerEquipoDemo().filter((x) => x.rol === 'repartidor' && x.activo);
}

export async function iniciarSesion({ correo, clave, idDemo }) {
  if (modoDemo()) {
    try {
      localStorage.setItem(CLAVE_DEMO, idDemo);
    } catch {
      /* sin almacenamiento */
    }
    return;
  }
  const sb = await obtenerSupabase();
  const { error } = await sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
  if (error) throw new Error('Correo o contraseña incorrectos.');
}

export async function cerrarSesion() {
  if (modoDemo()) {
    try {
      localStorage.removeItem(CLAVE_DEMO);
    } catch {
      /* nada */
    }
    return;
  }
  const sb = await obtenerSupabase();
  await sb.auth.signOut();
}

/* ---------- Pedidos ---------- */

// Forma común: { id, codigo, nombre, telefono, direccion, notas, total, metodoPago, costoDomicilio,
//   estado, mio, asignado, ubicacion, creadoEn, salioEn, entregadoEn, items }
export async function listarPedidos(miId) {
  if (modoDemo()) {
    const hace12h = Date.now() - 12 * 3600 * 1000;
    return (leerPedidosDemo() ?? [])
      .filter(
        (p) =>
          p.tipoEntrega === 'domicilio' &&
          ((p.estado === 'esperando_repartidor' && (!p.repartidorId || p.repartidorId === miId)) ||
            (p.estado === 'en_camino' && p.repartidorId === miId) ||
            (p.estado === 'entregado' && p.repartidorId === miId && new Date(p.entregadoEn).getTime() > hace12h)),
      )
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        telefono: p.telefono,
        direccion: p.direccion,
        notas: p.notas,
        total: p.total,
        metodoPago: p.metodoPago,
        costoDomicilio: p.costoDomicilio ?? null,
        estado: p.estado,
        mio: p.repartidorId === miId,
        asignado: Boolean(p.repartidorId),
        ubicacion: p.ubicacion ?? null,
        creadoEn: p.creadoEn,
        salioEn: p.salioEn ?? null,
        entregadoEn: p.entregadoEn ?? null,
        items: p.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, opciones: i.opciones ?? [], nota: i.nota ?? '' })),
      }));
  }
  const sb = await obtenerSupabase();
  const { data, error } = await sb.rpc('pedidos_repartidor');
  if (error) throw new Error(error.message);
  return data.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    nombre: f.cliente_nombre,
    telefono: f.cliente_telefono,
    direccion: f.direccion,
    notas: f.notas,
    total: f.total,
    metodoPago: f.metodo_pago,
    costoDomicilio: f.costo_domicilio,
    estado: f.estado,
    mio: f.mio,
    asignado: f.asignado,
    ubicacion: f.ubicacion_lat != null ? { lat: f.ubicacion_lat, lng: f.ubicacion_lng, precision: f.ubicacion_precision_m } : null,
    creadoEn: f.creado_en,
    salioEn: f.salio_en,
    entregadoEn: f.entregado_en,
    items: (f.items ?? []).map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, opciones: i.opciones ?? [], nota: i.nota ?? '' })),
  }));
}

async function llamar(funcion, id, comprobar, cambios) {
  if (modoDemo()) {
    await new Promise((r) => setTimeout(r, 250));
    const p = (leerPedidosDemo() ?? []).find((x) => x.id === id);
    const error = comprobar(p);
    if (error) throw new Error(error);
    actualizarPedidoDemo(id, cambios);
    return;
  }
  const sb = await obtenerSupabase();
  const { error } = await sb.rpc(funcion, { p_id: id });
  if (error) throw new Error(error.message);
}

export function salirConPedido(id, miId) {
  return llamar(
    'salir_con_pedido',
    id,
    (p) =>
      !p || p.estado !== 'esperando_repartidor' || (p.repartidorId && p.repartidorId !== miId)
        ? 'Este pedido ya lo tomó otro repartidor o ya no está listo para salir.'
        : null,
    { estado: 'en_camino', repartidorId: miId },
  );
}

export function marcarEntregado(id, miId) {
  return llamar(
    'marcar_entregado',
    id,
    (p) => (!p || p.estado !== 'en_camino' || p.repartidorId !== miId ? 'Este pedido ya no está a tu nombre.' : null),
    { estado: 'entregado' },
  );
}

export function liberarPedido(id, miId) {
  return llamar(
    'liberar_pedido',
    id,
    (p) => (!p || p.repartidorId !== miId ? 'Este pedido ya no está a tu nombre.' : null),
    { estado: 'esperando_repartidor', repartidorId: null },
  );
}

// En el modo demo los cambios de otras pestañas llegan al instante; con Supabase se consulta cada cierto tiempo.
export function escucharDemoSiAplica(callback) {
  return modoDemo() ? escucharDemo(callback) : () => {};
}

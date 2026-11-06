// Datos del panel del restaurante: sesión, pedidos, estados, comprobantes y tienda.
// Con Supabase usa la base de datos real; sin Supabase, el almacén demo del navegador.

import { obtenerSupabase, supabaseConfigurado } from './datos.js';
import {
  actualizarPedidoDemo,
  agregarPedidoDemo,
  CLAVES_DEMO,
  escucharDemo,
  guardarPedidosDemo,
  guardarPerfilDemo,
  guardarTiendaDemo,
  leerEquipoDemo,
  leerPedidosDemo,
  leerTiendaDemo,
} from './demo.js';

export const modoDemo = () => !supabaseConfigurado();

const CLAVE_SESION_DEMO = 'delicia-china:demo-sesion';

/* ---------- Sesión ---------- */

export async function sesionActiva() {
  if (modoDemo()) {
    try {
      return localStorage.getItem(CLAVE_SESION_DEMO) === '1';
    } catch {
      return false;
    }
  }
  const sb = await obtenerSupabase();
  const { data } = await sb.auth.getSession();
  return Boolean(data.session);
}

export async function iniciarSesion(correo, clave) {
  if (modoDemo()) {
    if (!clave) throw new Error('Escribe la contraseña.');
    try {
      localStorage.setItem(CLAVE_SESION_DEMO, '1');
    } catch {
      /* sin almacenamiento: la sesión dura mientras la página esté abierta */
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
      localStorage.removeItem(CLAVE_SESION_DEMO);
    } catch {
      /* nada */
    }
    return;
  }
  const sb = await obtenerSupabase();
  await sb.auth.signOut();
}

/* ---------- Rol y equipo ---------- */

// 'personal', 'repartidor' o null (sin acceso).
export async function miRol() {
  if (modoDemo()) return 'personal';
  const sb = await obtenerSupabase();
  const { data, error } = await sb.rpc('mi_rol');
  // Si la base aún no tiene roles (falta 05-repartidores.sql), todos los usuarios son personal.
  if (error?.code === 'PGRST202') return 'personal';
  if (error) throw error;
  return data ?? null;
}

export async function listarRepartidores() {
  if (modoDemo()) {
    return leerEquipoDemo()
      .filter((x) => x.rol === 'repartidor' && x.activo)
      .map((x) => ({ id: x.user_id, nombre: x.nombre || x.correo }));
  }
  const sb = await obtenerSupabase();
  const { data, error } = await sb.from('perfiles').select('user_id, nombre, rol, activo');
  if (error) return []; // sin la tabla de perfiles: no hay repartidores registrados
  return data
    .filter((x) => x.rol === 'repartidor')
    .map((x) => ({ id: x.user_id, nombre: x.nombre || 'Repartidor', activo: x.activo }));
}

export async function listarEquipo() {
  if (modoDemo()) return leerEquipoDemo().map((x) => ({ ...x, yo: x.user_id === 'demo-caja' }));
  const sb = await obtenerSupabase();
  const { data, error } = await sb.rpc('listar_equipo');
  if (error?.code === 'PGRST202') throw new Error('Falta ejecutar 05-repartidores.sql en Supabase.');
  if (error) throw new Error(error.message);
  return data;
}

export async function guardarPerfil(userId, { nombre, rol }) {
  if (modoDemo()) {
    guardarPerfilDemo(userId, { nombre, rol, activo: true });
    return;
  }
  const sb = await obtenerSupabase();
  const { error } = await sb.rpc('guardar_perfil', { p_user_id: userId, p_nombre: nombre, p_rol: rol, p_activo: true });
  if (error) throw new Error(error.message);
}

/* ---------- Pedidos ---------- */

// Forma común de un pedido en el panel:
// { id, codigo, creadoEn, actualizadoEn, nombre, telefono, tipoEntrega, direccion, notas,
//   metodoPago, total, estado, motivoRechazo, items: [{ nombre, cantidad, precio, opciones, nota }],
//   comprobante (ruta en Storage o imagen en el modo demo), ejemplo }

export async function listarPedidos() {
  if (modoDemo()) {
    let lista = leerPedidosDemo();
    if (lista === null) {
      lista = await pedidosDeEjemplo();
      guardarPedidosDemo(lista);
    }
    return lista;
  }

  const sb = await obtenerSupabase();
  const desde = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await sb
    .from('pedidos')
    .select('*, pedido_items(*)')
    .or(`creado_en.gte.${desde},estado.in.(pago_por_revisar,en_preparacion,en_camino,listo_para_recoger)`)
    .order('creado_en', { ascending: false })
    .limit(150);
  if (error) throw error;
  return data.map(desdeFila);
}

function desdeFila(f) {
  return {
    id: f.id,
    codigo: f.codigo,
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
    nombre: f.cliente_nombre,
    telefono: f.cliente_telefono,
    tipoEntrega: f.tipo_entrega,
    direccion: f.direccion,
    notas: f.notas,
    metodoPago: f.metodo_pago,
    total: f.total,
    estado: f.estado,
    motivoRechazo: f.motivo_rechazo,
    items: (f.pedido_items ?? [])
      .sort((a, b) => a.id - b.id)
      .map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio_unitario, opciones: i.opciones ?? [], nota: i.nota ?? '' })),
    comprobante: f.comprobante_path,
    repartidorId: f.repartidor_id ?? null,
    costoDomicilio: f.costo_domicilio ?? null,
    salioEn: f.salio_en ?? null,
    entregadoEn: f.entregado_en ?? null,
    ubicacion:
      f.ubicacion_lat != null && f.ubicacion_lng != null
        ? { lat: f.ubicacion_lat, lng: f.ubicacion_lng, precision: f.ubicacion_precision_m }
        : null,
    ejemplo: false,
  };
}

// Para buscar pedidos viejos que no están en la lista cargada.
export async function buscarPedidoPorCodigo(codigo) {
  if (modoDemo()) return (leerPedidosDemo() ?? []).find((p) => p.codigo === codigo) ?? null;
  const sb = await obtenerSupabase();
  const { data, error } = await sb.from('pedidos').select('*, pedido_items(*)').eq('codigo', codigo).maybeSingle();
  if (error) throw error;
  return data ? desdeFila(data) : null;
}

export async function cambiarEstado(id, estado, motivoRechazo = null) {
  if (modoDemo()) {
    actualizarPedidoDemo(id, { estado, motivoRechazo });
    return;
  }
  const sb = await obtenerSupabase();
  const { error } = await sb.from('pedidos').update({ estado, motivo_rechazo: motivoRechazo }).eq('id', id);
  if (error) throw new Error('No se pudo guardar el cambio. Revisa la conexión e inténtalo de nuevo.');
}

export async function asignarRepartidor(id, repartidorId) {
  if (modoDemo()) {
    actualizarPedidoDemo(id, { repartidorId: repartidorId || null });
    return;
  }
  const sb = await obtenerSupabase();
  const { error } = await sb.from('pedidos').update({ repartidor_id: repartidorId || null }).eq('id', id);
  if (error) throw new Error('No se pudo asignar el repartidor. Revisa la conexión.');
}

export async function guardarCostoDomicilio(id, valor) {
  if (modoDemo()) {
    actualizarPedidoDemo(id, { costoDomicilio: valor });
    return;
  }
  const sb = await obtenerSupabase();
  const { error } = await sb.from('pedidos').update({ costo_domicilio: valor }).eq('id', id);
  // Sin 05-repartidores.sql la columna no existe: el costo solo va en el mensaje de WhatsApp.
  if (error?.code === 'PGRST204') return;
  if (error) throw new Error('No se pudo guardar el costo del domicilio.');
}

const urlsFirmadas = new Map();

export async function urlComprobante(pedido) {
  if (!pedido.comprobante) return null;
  if (modoDemo()) return pedido.comprobante;
  if (urlsFirmadas.has(pedido.comprobante)) return urlsFirmadas.get(pedido.comprobante);
  const sb = await obtenerSupabase();
  const { data, error } = await sb.storage.from('comprobantes').createSignedUrl(pedido.comprobante, 3600);
  if (error) return null;
  urlsFirmadas.set(pedido.comprobante, data.signedUrl);
  return data.signedUrl;
}

/* ---------- Tienda ---------- */

export async function leerTienda() {
  if (modoDemo()) return leerTiendaDemo();
  const sb = await obtenerSupabase();
  const { data, error } = await sb
    .from('configuracion')
    .select('recibiendo_pedidos, horario_texto, whatsapp_tienda')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return { recibiendoPedidos: data.recibiendo_pedidos, horarioTexto: data.horario_texto, whatsappTienda: data.whatsapp_tienda };
}

export async function cambiarRecepcion(abierto) {
  if (modoDemo()) {
    guardarTiendaDemo({ recibiendoPedidos: abierto });
    return;
  }
  const sb = await obtenerSupabase();
  const { error } = await sb.from('configuracion').update({ recibiendo_pedidos: abierto }).eq('id', 1);
  if (error) throw new Error('No se pudo cambiar. Revisa la conexión.');
}

/* ---------- Tiempo real ---------- */

// callback(tipo) con tipo 'pedidos' o 'tienda'.
export async function escucharCambios(callback) {
  if (modoDemo()) {
    return escucharDemo((clave) =>
      callback(clave === CLAVES_DEMO.tienda ? 'tienda' : clave === CLAVES_DEMO.equipo ? 'equipo' : 'pedidos'),
    );
  }
  const sb = await obtenerSupabase();
  const canal = sb
    .channel('panel-pedidos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => callback('pedidos'))
    .subscribe();
  return () => sb.removeChannel(canal);
}

/* ---------- Simulación (solo demo) ---------- */

// Ubicaciones inventadas alrededor del local, solo para el modo demo.
const CLIENTES = [
  ['Laura Gómez', '3104567890', 'domicilio', 'Carrera 7 # 12-45, barrio Centro', { lat: 6.98712, lng: -73.04981, precision: 18 }],
  ['Andrés Rincón', '3157894561', 'recoger', null, null],
  ['María Fernanda Ortiz', '3209876543', 'domicilio', 'Calle 3 # 8-10, barrio La Feria', { lat: 6.99655, lng: -73.04402, precision: 35 }],
  ['Jorge Pabón', '3001112233', 'domicilio', 'Transversal 4 # 2-30, conjunto Los Pinos, torre 2', null],
  ['Camila Duarte', '3186543210', 'recoger', null, null],
];

const PLATOS = [
  ['Arroz chino especial', 22000],
  ['Pollo agridulce', 24000],
  ['Rollitos primavera (x3)', 12000],
  ['Chop suey mixto', 27000],
  ['Combo pareja', 58000],
  ['Sopa wantán', 16000],
  ['Gaseosa 1.5 L', 9000],
  ['Res mongoliana', 28000],
];

const OPCIONES = ['Sin cebolla', 'Sin picante', 'Salsa aparte'];
const METODOS = ['nequi', 'daviplata', 'transferencia'];

function azar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function pedidoAleatorio(minutosAtras = 0) {
  const [nombre, telefono, tipoEntrega, direccion, ubicacion] = azar(CLIENTES);
  const cuantos = 1 + Math.floor(Math.random() * 3);
  const elegidos = [...PLATOS].sort(() => Math.random() - 0.5).slice(0, cuantos);
  const items = elegidos.map(([n, precio], i) => ({
    nombre: n,
    cantidad: 1 + Math.floor(Math.random() * 2),
    precio,
    opciones: i === 0 && Math.random() > 0.5 ? [azar(OPCIONES)] : [],
    nota: i === 0 && Math.random() > 0.7 ? 'Bien caliente, por favor' : '',
  }));
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const metodoPago = azar(METODOS);
  const fecha = new Date(Date.now() - minutosAtras * 60000).toISOString();
  return {
    creadoEn: fecha,
    actualizadoEn: fecha,
    nombre,
    telefono,
    tipoEntrega,
    direccion,
    notas: tipoEntrega === 'domicilio' && Math.random() > 0.6 ? 'Timbre dañado, llamar al llegar' : '',
    metodoPago,
    total,
    estado: 'pago_por_revisar',
    motivoRechazo: null,
    items,
    comprobante: comprobanteFalso(metodoPago, total),
    ubicacion,
    ejemplo: true,
  };
}

export function simularPedido() {
  if (!modoDemo()) return null;
  return agregarPedidoDemo(pedidoAleatorio(0));
}

async function pedidosDeEjemplo() {
  const a = pedidoAleatorio(4);
  const b = { ...pedidoAleatorio(22), estado: 'en_preparacion' };
  const c = { ...pedidoAleatorio(48), estado: 'entregado' };
  return [a, b, c].map((p, i) => ({ ...p, codigo: 103 - i, id: `demo-${103 - i}-ejemplo` }));
}

// Dibuja un comprobante de ejemplo, claramente marcado como tal.
function comprobanteFalso(metodo, total) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 480;
  lienzo.height = 760;
  const c = lienzo.getContext('2d');
  const colores = { nequi: '#2b0a3d', daviplata: '#c8102e', transferencia: '#1d3f72' };
  c.fillStyle = '#f6f6f8';
  c.fillRect(0, 0, 480, 760);
  c.fillStyle = colores[metodo] ?? '#333';
  c.fillRect(0, 0, 480, 170);
  c.fillStyle = '#ffffff';
  c.font = 'bold 30px system-ui, sans-serif';
  c.fillText(metodo === 'transferencia' ? 'Transferencia' : metodo[0].toUpperCase() + metodo.slice(1), 32, 72);
  c.font = '20px system-ui, sans-serif';
  c.fillText('Envío exitoso', 32, 116);
  c.fillStyle = '#222';
  c.font = '18px system-ui, sans-serif';
  c.fillText('Valor', 32, 236);
  c.font = 'bold 40px system-ui, sans-serif';
  c.fillText('$ ' + total.toLocaleString('es-CO'), 32, 286);
  c.font = '18px system-ui, sans-serif';
  const filas = [
    ['Para', 'Delicia China'],
    ['Fecha', new Date().toLocaleDateString('es-CO')],
    ['Referencia', 'M' + Math.floor(1e7 + Math.random() * 9e7)],
  ];
  filas.forEach(([k, v], i) => {
    c.fillStyle = '#777';
    c.fillText(k, 32, 360 + i * 56);
    c.fillStyle = '#222';
    c.fillText(v, 200, 360 + i * 56);
  });
  c.save();
  c.translate(240, 640);
  c.rotate(-0.25);
  c.fillStyle = 'rgba(200, 30, 30, 0.75)';
  c.font = 'bold 44px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('EJEMPLO', 0, 0);
  c.restore();
  return lienzo.toDataURL('image/jpeg', 0.7);
}

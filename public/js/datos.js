// Carga del menú y envío de pedidos.
// Con Supabase configurado se usa la base de datos; si no, el "modo demo" con data/menu.json.

import { CONFIG } from './config.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let clienteSupabase = null;

export function supabaseConfigurado() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
}

export async function obtenerSupabase() {
  if (!supabaseConfigurado()) return null;
  if (!clienteSupabase) {
    const { createClient } = await import(SUPABASE_JS);
    clienteSupabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  }
  return clienteSupabase;
}

/* ---------- Menú ---------- */

// Devuelve siempre la misma forma, venga de donde venga:
// { origen, categorias, platos, opciones, tienda: { recibiendoPedidos, horarioTexto, whatsappTienda, datosPago } }
export async function cargarMenu() {
  if (supabaseConfigurado()) {
    try {
      return await menuDesdeSupabase();
    } catch (error) {
      console.warn('No se pudo leer el menú de Supabase; se usa el menú de ejemplo.', error);
    }
  }
  return menuLocal();
}

async function menuDesdeSupabase() {
  const sb = await obtenerSupabase();
  const [cats, platos, conf] = await Promise.all([
    sb.from('categorias').select('id, nombre, orden').eq('activa', true).order('orden'),
    sb.from('platos').select('id, categoria_id, nombre, descripcion, precio, orden').eq('disponible', true).order('orden'),
    sb
      .from('configuracion')
      .select('recibiendo_pedidos, horario_texto, whatsapp_tienda, datos_pago, opciones_generales')
      .eq('id', 1)
      .single(),
  ]);
  for (const r of [cats, platos, conf]) if (r.error) throw r.error;

  return {
    origen: 'supabase',
    categorias: cats.data.map((c) => ({ id: String(c.id), nombre: c.nombre })),
    platos: platos.data.map((p) => ({
      id: p.id,
      categoriaId: String(p.categoria_id),
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precio: p.precio,
    })),
    opciones: conf.data.opciones_generales ?? [],
    tienda: {
      recibiendoPedidos: conf.data.recibiendo_pedidos,
      horarioTexto: conf.data.horario_texto ?? '',
      whatsappTienda: conf.data.whatsapp_tienda ?? '',
      datosPago: conf.data.datos_pago ?? [],
    },
  };
}

async function menuLocal() {
  // En la vista previa publicada, el menú viene incrustado en la página.
  const json = window.MENU_EMBEBIDO ?? (await (await fetch('data/menu.json')).json());
  const idDe = (nombre) => json.categorias.indexOf(nombre).toString();
  return {
    origen: 'demo',
    categorias: json.categorias.map((nombre, i) => ({ id: String(i), nombre })),
    platos: json.platos.map((p) => ({
      id: p.id,
      categoriaId: idDe(p.categoria),
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      precio: p.precio,
    })),
    opciones: json.opcionesGenerales ?? [],
    tienda: { ...CONFIG.demo },
  };
}

/* ---------- Pedido ---------- */

// pedido = { nombre, telefono, tipoEntrega, direccion, notas, metodoPago, comprobante: { blob, ext, tipo }, lineas }
// Devuelve { codigo, total, demo }
export async function enviarPedido(pedido) {
  const items = pedido.lineas.map((l) => ({
    plato_id: l.plato.id,
    cantidad: l.cantidad,
    opciones: l.opciones,
    nota: l.nota,
  }));

  if (!supabaseConfigurado()) {
    // Modo demo: no se guarda nada; se simula la espera de la red.
    await new Promise((r) => setTimeout(r, 900));
    const total = pedido.lineas.reduce((s, l) => s + l.plato.precio * l.cantidad, 0);
    return { codigo: 100 + Math.floor(Math.random() * 900), total, demo: true };
  }

  const sb = await obtenerSupabase();
  const ruta = `pendientes/${crypto.randomUUID()}.${pedido.comprobante.ext}`;

  const subida = await sb.storage
    .from('comprobantes')
    .upload(ruta, pedido.comprobante.blob, { contentType: pedido.comprobante.tipo, upsert: false });
  if (subida.error) {
    console.error(subida.error);
    throw new Error('No se pudo subir el comprobante. Revisa tu conexión e inténtalo de nuevo.');
  }

  const { data, error } = await sb.rpc('crear_pedido', {
    p_cliente_nombre: pedido.nombre,
    p_cliente_telefono: pedido.telefono,
    p_tipo_entrega: pedido.tipoEntrega,
    p_direccion: pedido.direccion,
    p_notas: pedido.notas,
    p_metodo_pago: pedido.metodoPago,
    p_comprobante_path: ruta,
    p_items: items,
  });
  if (error) {
    console.error(error);
    // Los mensajes de crear_pedido ya están escritos para el cliente.
    throw new Error(error.message || 'No se pudo enviar el pedido. Inténtalo de nuevo.');
  }
  return { codigo: data.codigo, total: data.total, demo: false };
}

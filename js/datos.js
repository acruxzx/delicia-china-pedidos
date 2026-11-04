// Carga del menú y del estado del restaurante.
// Orden de búsqueda: Supabase (si está configurado) → data/menu.json (modo demo).

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

// Devuelve siempre la misma forma, venga de donde venga:
// { origen, categorias: [{id, nombre}], platos: [{id, categoriaId, nombre, descripcion, precio}], opciones, tienda }
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
    sb.from('configuracion').select('recibiendo_pedidos, horario_texto, opciones_generales').eq('id', 1).single(),
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

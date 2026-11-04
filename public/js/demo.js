// Almacén del "modo demo": guarda pedidos y el estado de la tienda en el navegador.
// La web del cliente y el panel lo comparten cuando se abren en el mismo navegador,
// así se puede probar el ciclo completo sin Supabase. Con Supabase no se usa.

import { CONFIG } from './config.js';

const CLAVE_PEDIDOS = 'delicia-china:demo-pedidos';
const CLAVE_TIENDA = 'delicia-china:demo-tienda';
const MAX_PEDIDOS = 25;

export const EVENTO_DEMO = 'delicia-china:demo-cambio';

function leerJSON(clave, porDefecto) {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? 'null');
    return v ?? porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardarJSON(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    window.dispatchEvent(new CustomEvent(EVENTO_DEMO, { detail: { clave } }));
    return true;
  } catch {
    return false; // sin espacio o sin almacenamiento
  }
}

/* ---------- Tienda ---------- */

export function leerTiendaDemo() {
  const guardada = leerJSON(CLAVE_TIENDA, {});
  return { ...CONFIG.demo, ...guardada };
}

export function guardarTiendaDemo(cambios) {
  const actual = leerJSON(CLAVE_TIENDA, {});
  guardarJSON(CLAVE_TIENDA, { ...actual, ...cambios });
}

/* ---------- Pedidos ---------- */

export function leerPedidosDemo() {
  const lista = leerJSON(CLAVE_PEDIDOS, null);
  if (Array.isArray(lista)) return lista;
  return null; // nunca se ha creado: el panel siembra ejemplos
}

export function guardarPedidosDemo(lista) {
  // Si no cabe (los comprobantes pesan), se descartan los más viejos.
  let recortada = lista.slice(0, MAX_PEDIDOS);
  while (recortada.length && !guardarJSON(CLAVE_PEDIDOS, recortada)) {
    recortada = recortada.slice(0, -1);
  }
}

export function siguienteCodigoDemo(lista) {
  return (lista ?? []).reduce((max, p) => Math.max(max, p.codigo), 100) + 1;
}

export function agregarPedidoDemo(pedido) {
  const lista = leerPedidosDemo() ?? [];
  const codigo = siguienteCodigoDemo(lista);
  const nuevo = { ...pedido, codigo, id: `demo-${codigo}-${Date.now()}` };
  guardarPedidosDemo([nuevo, ...lista]);
  return nuevo;
}

export function actualizarPedidoDemo(id, cambios) {
  const lista = leerPedidosDemo() ?? [];
  guardarPedidosDemo(lista.map((p) => (p.id === id ? { ...p, ...cambios, actualizadoEn: new Date().toISOString() } : p)));
}

// Avisa cuando otra pestaña (o esta misma) cambia el almacén demo.
export function escucharDemo(callback) {
  const alCambiarOtraPestana = (e) => {
    if (e.key === CLAVE_PEDIDOS || e.key === CLAVE_TIENDA) callback(e.key);
  };
  const alCambiarAqui = (e) => callback(e.detail.clave);
  window.addEventListener('storage', alCambiarOtraPestana);
  window.addEventListener(EVENTO_DEMO, alCambiarAqui);
  return () => {
    window.removeEventListener('storage', alCambiarOtraPestana);
    window.removeEventListener(EVENTO_DEMO, alCambiarAqui);
  };
}

export const CLAVES_DEMO = { pedidos: CLAVE_PEDIDOS, tienda: CLAVE_TIENDA };

/* ---------- Imagen liviana para guardar en el navegador ---------- */

export async function imagenLiviana(blob, maxLado = 900, calidad = 0.7) {
  try {
    const bitmap = await createImageBitmap(blob);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close?.();
    return lienzo.toDataURL('image/jpeg', calidad);
  } catch {
    return null;
  }
}

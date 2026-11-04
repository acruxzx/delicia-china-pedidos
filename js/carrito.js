// Carrito del cliente. Se guarda en el navegador para no perderlo si recarga la página.
// Cada plato tiene cantidad, opciones (por ejemplo "Sin cebolla") y una nota libre.
// Las opciones y la nota aplican a todas las unidades de ese plato.

const CLAVE = 'delicia-china:carrito';
const MAX_UNIDADES = 50;
const MAX_NOTA = 200;

export function crearCarrito() {
  let items = leer(); // { [platoId]: { cantidad, opciones: [], nota: '' } }
  const oyentes = new Set();

  function avisar() {
    guardar(items);
    oyentes.forEach((fn) => fn());
  }

  return {
    cantidad(id) {
      return items[id]?.cantidad ?? 0;
    },
    detalle(id) {
      const it = items[id];
      return it ? { opciones: [...it.opciones], nota: it.nota } : { opciones: [], nota: '' };
    },
    cambiar(id, delta) {
      const actual = items[id] ?? { cantidad: 0, opciones: [], nota: '' };
      const nueva = Math.max(0, Math.min(MAX_UNIDADES, actual.cantidad + delta));
      if (nueva === 0) delete items[id];
      else items[id] = { ...actual, cantidad: nueva };
      avisar();
    },
    // Guarda opciones y nota sin volver a pintar la pantalla (no cambia el total).
    personalizar(id, { opciones, nota }) {
      if (!items[id]) return;
      items[id] = {
        ...items[id],
        opciones: Array.isArray(opciones) ? opciones : items[id].opciones,
        nota: typeof nota === 'string' ? nota.slice(0, MAX_NOTA) : items[id].nota,
      };
      guardar(items);
    },
    vaciar() {
      items = {};
      avisar();
    },
    lineas(platosPorId) {
      return Object.entries(items)
        .map(([id, it]) => ({ plato: platosPorId.get(Number(id)), ...it }))
        .filter((l) => l.plato);
    },
    alCambiar(fn) {
      oyentes.add(fn);
    },
    // Quita platos que ya no existen en el menú y opciones que ya no se ofrecen.
    limpiar(platosPorId, opcionesValidas = []) {
      let cambio = false;
      for (const [id, it] of Object.entries(items)) {
        if (!platosPorId.has(Number(id))) {
          delete items[id];
          cambio = true;
          continue;
        }
        const filtradas = it.opciones.filter((o) => opcionesValidas.includes(o));
        if (filtradas.length !== it.opciones.length) {
          it.opciones = filtradas;
          cambio = true;
        }
      }
      if (cambio) avisar();
    },
  };
}

function leer() {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
    if (!crudo || typeof crudo !== 'object') return {};
    const items = {};
    for (const [id, valor] of Object.entries(crudo)) {
      // Formato de la semana 1: { id: cantidad }
      if (typeof valor === 'number') items[id] = { cantidad: valor, opciones: [], nota: '' };
      else if (valor && typeof valor.cantidad === 'number') {
        items[id] = {
          cantidad: valor.cantidad,
          opciones: Array.isArray(valor.opciones) ? valor.opciones.filter((o) => typeof o === 'string') : [],
          nota: typeof valor.nota === 'string' ? valor.nota.slice(0, MAX_NOTA) : '',
        };
      }
    }
    return items;
  } catch {
    return {};
  }
}

function guardar(items) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado): el carrito vive solo en esta visita.
  }
}

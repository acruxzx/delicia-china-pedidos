// Carrito del cliente. Se guarda en el navegador para no perderlo si recarga la página.
// En la semana 2 se le agregan notas y opciones por plato.

const CLAVE = 'delicia-china:carrito';

export function crearCarrito() {
  let items = leer(); // { [platoId]: cantidad }
  const oyentes = new Set();

  function avisar() {
    guardar(items);
    oyentes.forEach((fn) => fn());
  }

  return {
    cantidad(id) {
      return items[id] ?? 0;
    },
    cambiar(id, delta) {
      const nueva = Math.max(0, Math.min(50, (items[id] ?? 0) + delta));
      if (nueva === 0) delete items[id];
      else items[id] = nueva;
      avisar();
    },
    vaciar() {
      items = {};
      avisar();
    },
    lineas(platosPorId) {
      return Object.entries(items)
        .map(([id, cantidad]) => ({ plato: platosPorId.get(Number(id)), cantidad }))
        .filter((l) => l.plato);
    },
    alCambiar(fn) {
      oyentes.add(fn);
    },
    // Quita platos que ya no existen en el menú (por ejemplo, si cambió el menú).
    limpiar(platosPorId) {
      let cambio = false;
      for (const id of Object.keys(items)) {
        if (!platosPorId.has(Number(id))) {
          delete items[id];
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
    return crudo && typeof crudo === 'object' ? crudo : {};
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

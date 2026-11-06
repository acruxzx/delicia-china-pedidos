// Mapas y ubicación: Leaflet + OpenStreetMap, cargados solo cuando se necesitan.
// Se usa en el formulario del cliente (marcar dónde entregar) y en el panel (ver la ruta).

import { CONFIG } from './config.js';

const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';
let promesaLeaflet = null;

export function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  // Se esperan el CSS y el JS: sin el CSS, los cuadros del mapa quedan desordenados.
  const cargar = (crear) =>
    new Promise((ok, falla) => {
      const el = crear();
      el.onload = ok;
      el.onerror = falla;
      document.head.append(el);
    });
  promesaLeaflet ??= Promise.all([
    cargar(() => Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${LEAFLET}/leaflet.css` })),
    cargar(() => Object.assign(document.createElement('script'), { src: `${LEAFLET}/leaflet.js` })),
  ])
    .then(() => window.L)
    .catch(() => {
      promesaLeaflet = null;
      throw new Error('No se pudo cargar el mapa. Revisa la conexión.');
    });
  return promesaLeaflet;
}

export const LOCAL = CONFIG.ubicacionLocal;

// Crea un mapa con el estilo del sitio. `opciones.interactivo` en false lo deja quieto.
export function crearMapa(L, contenedor, { centro = LOCAL, zoom = 16, interactivo = true } = {}) {
  const mapa = L.map(contenedor, {
    center: [centro.lat, centro.lng],
    zoom,
    zoomControl: interactivo,
    dragging: interactivo,
    scrollWheelZoom: false, // evita mover el mapa sin querer al bajar por la página
    doubleClickZoom: interactivo,
    touchZoom: interactivo,
    keyboard: interactivo,
    attributionControl: true,
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(mapa);
  mapa.attributionControl.setPrefix(false);
  return mapa;
}

// Pin dibujado con SVG: no depende de imágenes externas.
export function icono(L, tipo) {
  const colores = {
    cliente: ['#d6a645', '#131718'],
    local: ['#c2453a', '#ffffff'],
  };
  const [relleno, punto] = colores[tipo] ?? colores.cliente;
  return L.divIcon({
    className: 'pin-mapa',
    html: `<svg viewBox="0 0 32 44" width="32" height="44" aria-hidden="true">
      <path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 43 16 43s15-16 15-27.2C31 7.6 24.3 1 16 1z" fill="${relleno}" stroke="#131718" stroke-width="2"/>
      <circle cx="16" cy="16" r="5.5" fill="${punto}"/>
    </svg>`,
    iconSize: [32, 44],
    iconAnchor: [16, 43],
  });
}

// Distancia en línea recta (km). La distancia por calles suele ser un 20-40 % mayor.
export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function textoDistancia(km) {
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10} m`;
  return `${km.toLocaleString('es-CO', { maximumFractionDigits: 1 })} km`;
}

export function enlacesRuta({ lat, lng }) {
  const destino = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
    waze: `https://waze.com/ul?ll=${destino}&navigate=yes`,
  };
}

export function enlaceBusqueda(direccion) {
  const texto = `${direccion}, ${CONFIG.ciudad}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
}

// Pide la ubicación al navegador. Devuelve { lat, lng, precision } o lanza un error con un mensaje claro.
export function pedirUbicacion() {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) {
      rechazar(new Error('Este navegador no puede compartir la ubicación. Márcala tocando el mapa.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolver({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
        }),
      (error) => {
        const mensajes = {
          1: 'No diste permiso para usar tu ubicación. Puedes marcarla tocando el mapa, o seguir solo con la dirección.',
          2: 'No pudimos encontrar tu ubicación. Activa el GPS o márcala tocando el mapa.',
          3: 'Tu ubicación tardó demasiado. Inténtalo de nuevo o márcala tocando el mapa.',
        };
        rechazar(new Error(mensajes[error.code] ?? mensajes[2]));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

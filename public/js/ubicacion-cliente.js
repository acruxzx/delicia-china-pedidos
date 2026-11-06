// Ubicación opcional del domicilio en el formulario del cliente.
// "Usar mi ubicación" pide el GPS; si no hay permiso, el cliente puede tocar el mapa.
// El pin se puede mover para corregir. La dirección escrita sigue siendo obligatoria.

import { CONFIG } from './config.js';
import { cargarLeaflet, crearMapa, distanciaKm, icono, LOCAL, pedirUbicacion, textoDistancia } from './mapa.js';

export function iniciarUbicacionCliente() {
  const $ = (s) => document.querySelector(s);
  const el = {
    usar: $('#usar-ubicacion'),
    textoUsar: $('#texto-usar-ubicacion'),
    envoltura: $('#mapa-cliente-envoltura'),
    mapa: $('#mapa-cliente'),
    info: $('#info-ubicacion'),
    quitar: $('#quitar-ubicacion'),
    error: $('#error-ubicacion'),
  };

  let L = null;
  let mapa = null;
  let marcador = null;
  let valor = null; // { lat, lng, precision }

  el.usar.addEventListener('click', usarGps);
  el.quitar.addEventListener('click', limpiar);

  async function usarGps() {
    el.error.hidden = true;
    el.usar.disabled = true;
    el.textoUsar.textContent = 'Buscando tu ubicación…';
    const mapaListo = abrirMapa(); // en paralelo con el GPS
    try {
      const pos = await pedirUbicacion();
      await mapaListo.catch(() => {});
      ponerPin(pos, { precision: pos.precision, centrar: true });
    } catch (error) {
      mostrarError(error.message);
      await mapaListo.catch(() => {});
      if (mapa && !valor) el.info.textContent = 'Toca el mapa en el lugar donde quieres recibir el pedido.';
      if (!mapa && !valor) el.envoltura.hidden = true;
    } finally {
      el.usar.disabled = false;
      el.textoUsar.textContent = valor ? 'Actualizar mi ubicación' : 'Usar mi ubicación actual';
    }
  }

  async function abrirMapa() {
    el.envoltura.hidden = false;
    if (mapa) {
      mapa.invalidateSize();
      return;
    }
    try {
      L = await cargarLeaflet();
    } catch (error) {
      el.mapa.hidden = true;
      throw error;
    }
    el.mapa.hidden = false;
    mapa = crearMapa(L, el.mapa, { centro: LOCAL, zoom: 15 });
    mapa.on('click', (e) => ponerPin(e.latlng, { precision: null, centrar: false }));
    setTimeout(() => mapa.invalidateSize(), 60);
  }

  function ponerPin({ lat, lng }, { precision, centrar }) {
    valor = { lat, lng, precision };
    el.error.hidden = true;
    el.envoltura.hidden = false;
    if (mapa) {
      if (marcador) marcador.setLatLng([lat, lng]);
      else {
        marcador = L.marker([lat, lng], { icon: icono(L, 'cliente'), draggable: true, keyboard: false, title: 'Lugar de entrega' }).addTo(mapa);
        marcador.on('dragend', () => {
          const p = marcador.getLatLng();
          ponerPin({ lat: p.lat, lng: p.lng }, { precision: null, centrar: false });
        });
      }
      if (centrar) mapa.setView([lat, lng], 17);
    }
    pintarInfo();
  }

  function pintarInfo() {
    if (!valor) return;
    const km = distanciaKm(LOCAL, valor);
    const partes = [];
    if (!mapa) partes.push('Ubicación guardada, pero no se pudo mostrar el mapa.');
    else partes.push(valor.precision == null ? 'Pin ubicado a mano.' : 'Mueve el pin si no quedó exacto.');
    if (valor.precision != null) partes.push(`Precisión aprox. ${valor.precision} m.`);
    partes.push(`A ${textoDistancia(km)} del local.`);
    el.info.textContent = partes.join(' ');
    el.info.classList.toggle('lejos', km > CONFIG.distanciaMaximaKm);
    if (km > CONFIG.distanciaMaximaKm) {
      el.info.textContent += ` Está lejos de ${CONFIG.ciudad.split(',')[0]}: revisa que el pin esté bien.`;
    }
    el.quitar.hidden = false;
  }

  function mostrarError(mensaje) {
    el.error.textContent = mensaje;
    el.error.hidden = false;
  }

  function limpiar() {
    valor = null;
    marcador?.remove();
    marcador = null;
    el.envoltura.hidden = true;
    el.error.hidden = true;
    el.info.textContent = '';
    el.info.classList.remove('lejos');
    el.quitar.hidden = true;
    el.textoUsar.textContent = 'Usar mi ubicación actual';
  }

  return {
    // Ubicación lista para enviar, o null si el cliente no la compartió.
    valor: () => (valor ? { ...valor } : null),
    limpiar,
  };
}

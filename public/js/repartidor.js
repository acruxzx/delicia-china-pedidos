// App del repartidor (celular): pedidos para salir, entregas en curso, rutas y entregado.
// Funciona con las dos formas de reparto: "el primero que lo tome" y "asignado por quien despacha".

import { NOMBRES_PAGO } from './config.js';
import { cargarLeaflet, crearMapa, distanciaKm, enlaceBusqueda, enlacesRuta, icono, LOCAL, textoDistancia } from './mapa.js';
import {
  cerrarSesion,
  escucharDemoSiAplica,
  iniciarSesion,
  liberarPedido,
  listarPedidos,
  marcarEntregado,
  modoDemo,
  repartidoresDemo,
  salirConPedido,
  sesion,
} from './repartidor-datos.js';

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const hora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const $ = (s) => document.querySelector(s);
const CADA_CUANTO = 15000;

const estado = {
  yo: null, // { id, nombre, rol }
  pedidos: [],
  conocidos: null, // para avisar de pedidos nuevos
  confirmando: null, // id del pedido con "¿Entregado?" abierto
  ocupado: new Set(), // ids con una acción en curso
};

iniciar();

/* ---------- Arranque e ingreso ---------- */

async function iniciar() {
  const demo = modoDemo();
  $('#etiqueta-demo').hidden = !demo;
  $('#ingreso-real').hidden = demo;
  $('#ingreso-demo').hidden = !demo;
  if (demo) {
    const lista = repartidoresDemo();
    $('#i-demo').innerHTML = lista.length
      ? lista.map((r) => `<option value="${r.user_id}">${escapar(r.nombre || r.correo)}</option>`).join('')
      : '<option value="">No hay repartidores en el equipo demo</option>';
  }
  $('#form-ingreso').addEventListener('submit', entrar);
  activarEventos();

  try {
    const s = await sesion();
    if (s) await abrir(s);
    else mostrarPantalla('ingreso');
  } catch (err) {
    mostrarPantalla('ingreso');
    mostrarErrorIngreso(err.message || 'No se pudo conectar. Revisa tu internet y vuelve a abrir la página.');
  }
}

function mostrarPantalla(p) {
  document.body.dataset.pantalla = p;
}

function mostrarErrorIngreso(texto) {
  const e = $('#error-ingreso');
  e.innerHTML = texto;
  e.hidden = false;
}

async function entrar(e) {
  e.preventDefault();
  $('#error-ingreso').hidden = true;
  const boton = $('#entrar');
  boton.disabled = true;
  boton.textContent = 'Entrando…';
  try {
    if (modoDemo() && !$('#i-demo').value) throw new Error('No hay repartidores en el equipo demo.');
    await iniciarSesion({ correo: $('#i-correo').value, clave: $('#i-clave').value, idDemo: $('#i-demo').value });
    $('#i-clave').value = '';
    const s = await sesion();
    if (!s) throw new Error('No se pudo iniciar sesión. Inténtalo de nuevo.');
    await abrir(s);
  } catch (err) {
    mostrarErrorIngreso(escapar(err.message));
  } finally {
    boton.disabled = false;
    boton.textContent = 'Entrar';
  }
}

let temporizador = null;
let dejarDeEscuchar = () => {};

async function abrir(s) {
  if (s.rol !== 'repartidor') {
    await cerrarSesion();
    mostrarPantalla('ingreso');
    mostrarErrorIngreso(
      s.rol === 'personal'
        ? 'Esta cuenta es del personal. Usa el <a href="/panel/">panel de pedidos</a>.'
        : 'Tu usuario todavía no tiene acceso. Pide en el restaurante que te asignen el rol de repartidor.',
    );
    return;
  }
  estado.yo = s;
  $('#mi-nombre').textContent = s.nombre;
  mostrarPantalla('trabajo');
  await recargar();
  dejarDeEscuchar = escucharDemoSiAplica(() => recargar());
  temporizador = setInterval(() => document.visibilityState === 'visible' && recargar(), CADA_CUANTO);
  mantenerPantallaEncendida();
}

async function salir() {
  clearInterval(temporizador);
  dejarDeEscuchar();
  await cerrarSesion();
  estado.yo = null;
  estado.pedidos = [];
  estado.conocidos = null;
  mostrarPantalla('ingreso');
}

/* ---------- Carga ---------- */

async function recargar() {
  if (!estado.yo) return;
  let lista;
  try {
    lista = await listarPedidos(estado.yo.id);
  } catch (err) {
    console.error(err);
    $('#ultima-actualizacion').textContent = 'Sin conexión. Reintentando…';
    return;
  }
  avisarNuevos(lista);
  estado.pedidos = lista;
  $('#ultima-actualizacion').textContent = `Actualizado a las ${hora.format(new Date())}`;
  pintar();
}

function avisarNuevos(lista) {
  const paraSalir = lista.filter((p) => p.estado === 'esperando_repartidor');
  if (estado.conocidos) {
    const nuevos = paraSalir.filter((p) => !estado.conocidos.has(p.id + (p.mio ? ':mio' : '')));
    const asignados = nuevos.filter((p) => p.mio);
    if (asignados.length) avisar(`Te asignaron el pedido #${asignados[0].codigo}`, true);
    else if (nuevos.length) avisar(`Pedido #${nuevos[0].codigo} listo para salir`, true);
  }
  estado.conocidos = new Set(paraSalir.map((p) => p.id + (p.mio ? ':mio' : '')));
}

/* ---------- Pintar ---------- */

function pintar() {
  const enCamino = estado.pedidos.filter((p) => p.estado === 'en_camino');
  const paraSalir = estado.pedidos
    .filter((p) => p.estado === 'esperando_repartidor')
    .sort((a, b) => Number(b.mio) - Number(a.mio) || a.creadoEn.localeCompare(b.creadoEn));
  const entregados = estado.pedidos
    .filter((p) => p.estado === 'entregado')
    .sort((a, b) => (b.entregadoEn ?? '').localeCompare(a.entregadoEn ?? ''));

  $('#cuenta-camino').textContent = enCamino.length;
  $('#cuenta-salir').textContent = paraSalir.length;
  $('#cuenta-entregados').textContent = entregados.length;
  $('#cuenta-salir').classList.toggle('alerta', paraSalir.length > 0);
  $('#vacio-camino').hidden = enCamino.length > 0;
  $('#vacio-salir').hidden = paraSalir.length > 0;

  // Conservar lo que esté escrito o enfocado no aplica aquí: no hay campos de texto.
  $('#lista-camino').innerHTML = enCamino.map(htmlPedido).join('');
  $('#lista-salir').innerHTML = paraSalir.map(htmlPedido).join('');
  $('#lista-entregados').innerHTML = entregados.length
    ? entregados
        .map(
          (p) =>
            `<li><strong>#${p.codigo}</strong> ${escapar(p.nombre)} · ${escapar(p.direccion ?? '')}<span>${
              p.entregadoEn ? hora.format(new Date(p.entregadoEn)) : ''
            }</span></li>`,
        )
        .join('')
    : '<li class="nota">Aún no has entregado pedidos hoy.</li>';

  document.title = paraSalir.length ? `(${paraSalir.length}) Repartos · Delicia China` : 'Repartos · Delicia China';
  if (!$('#zona-mapa').hidden) pintarMapa();
}

function htmlPedido(p) {
  const km = p.ubicacion ? textoDistancia(distanciaKm(LOCAL, p.ubicacion)) : null;
  const unidades = p.items.reduce((s, i) => s + i.cantidad, 0);
  const ocupado = estado.ocupado.has(p.id);
  const cobro =
    p.costoDomicilio > 0
      ? `<strong class="r-cobrar">Cobrar domicilio: ${pesos.format(p.costoDomicilio)}</strong>`
      : '<span class="r-sin-cobro">Domicilio: confírmalo con el local</span>';

  let acciones = '';
  if (p.estado === 'esperando_repartidor') {
    acciones = `
      <button type="button" class="boton-principal r-boton-grande" data-accion="salir" ${ocupado ? 'disabled' : ''}>
        ${ocupado ? 'Un momento…' : 'Salir con el pedido'}
      </button>
      ${p.mio ? '<button type="button" class="enlace r-liberar" data-accion="liberar">No puedo llevarlo</button>' : ''}`;
  } else if (p.estado === 'en_camino') {
    const rutas = p.ubicacion ? enlacesRuta(p.ubicacion) : null;
    const tel = p.telefono;
    const wa = `https://wa.me/57${tel}?text=${encodeURIComponent(
      `Hola ${p.nombre.split(' ')[0]}, soy ${estado.yo.nombre}, el repartidor de Delicia China. Voy en camino con tu pedido #${p.codigo}.`,
    )}`;
    const confirmando = estado.confirmando === p.id;
    acciones = `
      <div class="r-fila-botones">
        ${
          rutas
            ? `<a class="r-boton" href="${rutas.google}" target="_blank" rel="noopener">Google Maps</a>
               <a class="r-boton" href="${rutas.waze}" target="_blank" rel="noopener">Waze</a>`
            : `<a class="r-boton r-boton-ancho" href="${enlaceBusqueda(p.direccion ?? '')}" target="_blank" rel="noopener">Buscar dirección en el mapa</a>`
        }
      </div>
      <div class="r-fila-botones">
        <a class="r-boton" href="tel:+57${tel}">Llamar</a>
        <a class="r-boton r-boton-wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
      ${
        confirmando
          ? `<div class="r-confirmar" role="group" aria-label="Confirmar entrega">
              <p>¿Entregaste el pedido #${p.codigo} a ${escapar(p.nombre.split(' ')[0])}?</p>
              <div class="r-fila-botones">
                <button type="button" class="boton-secundario" data-accion="cancelar">Todavía no</button>
                <button type="button" class="boton-principal" data-accion="entregado" ${ocupado ? 'disabled' : ''}>${
                  ocupado ? 'Guardando…' : 'Sí, entregado'
                }</button>
              </div>
            </div>`
          : `<button type="button" class="boton-principal r-boton-grande" data-accion="confirmar">Entregado</button>`
      }
      <button type="button" class="enlace r-liberar" data-accion="liberar">No puedo llevarlo</button>`;
  }

  return `
    <li class="r-pedido${p.mio && p.estado === 'esperando_repartidor' ? ' asignado' : ''}" data-id="${p.id}">
      <div class="r-cabeza">
        <strong class="r-codigo">#${p.codigo}</strong>
        ${p.mio && p.estado === 'esperando_repartidor' ? '<span class="r-etiqueta">Te lo asignaron</span>' : ''}
        <span class="r-tiempo">${
          p.estado === 'en_camino' && p.salioEn ? `Saliste ${hora.format(new Date(p.salioEn))}` : hace(p.creadoEn)
        }</span>
      </div>
      <p class="r-direccion">${escapar(p.direccion ?? 'Sin dirección')}</p>
      <p class="r-cliente">${escapar(p.nombre)}${km ? ` · ${km} del local` : ''}</p>
      ${p.notas ? `<p class="r-notas">“${escapar(p.notas)}”</p>` : ''}
      <p class="r-items">${unidades} ${unidades === 1 ? 'producto' : 'productos'}: ${p.items
        .map((i) => `${i.cantidad}× ${escapar(i.nombre)}`)
        .join(', ')}</p>
      <p class="r-pago"><span class="r-pagado">Pagado por ${NOMBRES_PAGO[p.metodoPago] ?? p.metodoPago} · ${pesos.format(p.total)}</span> ${cobro}</p>
      <div class="r-acciones">${acciones}</div>
    </li>`;
}

/* ---------- Mapa ---------- */

let mapa = null;
let capa = null;

async function alternarMapa() {
  const zona = $('#zona-mapa');
  const abrir = zona.hidden;
  zona.hidden = !abrir;
  $('#ver-mapa').setAttribute('aria-pressed', String(abrir));
  if (abrir) await pintarMapa();
}

async function pintarMapa() {
  let L;
  try {
    L = await cargarLeaflet();
  } catch {
    $('#mapa-reparto').innerHTML = '<p class="nota">No se pudo cargar el mapa. Usa los botones de cada pedido.</p>';
    return;
  }
  if (!mapa) {
    mapa = crearMapa(L, $('#mapa-reparto'), { centro: LOCAL, zoom: 14 });
    L.marker([LOCAL.lat, LOCAL.lng], { icon: icono(L, 'local'), title: 'Delicia China', keyboard: false }).addTo(mapa);
  }
  capa?.forEach((m) => m.remove());
  capa = [];
  const puntos = [[LOCAL.lat, LOCAL.lng]];
  for (const p of estado.pedidos) {
    if (!p.ubicacion || p.estado === 'entregado') continue;
    const mio = p.estado === 'en_camino' || p.mio;
    const m = L.marker([p.ubicacion.lat, p.ubicacion.lng], {
      icon: icono(L, mio ? 'cliente' : 'disponible'),
      title: `#${p.codigo}`,
      keyboard: false,
    })
      .addTo(mapa)
      .bindPopup(`<strong>#${p.codigo}</strong><br>${escapar(p.direccion ?? '')}`);
    capa.push(m);
    puntos.push([p.ubicacion.lat, p.ubicacion.lng]);
  }
  mapa.invalidateSize();
  if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [32, 32], maxZoom: 16 });
  else mapa.setView([LOCAL.lat, LOCAL.lng], 15);
  setTimeout(() => mapa?.invalidateSize(), 80);
}

/* ---------- Acciones ---------- */

async function accion(nombre, id) {
  const p = estado.pedidos.find((x) => x.id === id);
  if (!p) return;
  if (nombre === 'confirmar') {
    estado.confirmando = id;
    pintar();
    document.querySelector(`.r-pedido[data-id="${id}"] [data-accion="entregado"]`)?.focus();
    return;
  }
  if (nombre === 'cancelar') {
    estado.confirmando = null;
    pintar();
    return;
  }

  const funciones = { salir: salirConPedido, entregado: marcarEntregado, liberar: liberarPedido };
  const mensajes = {
    salir: `Saliste con el pedido #${p.codigo}. ¡Buen viaje!`,
    entregado: `Pedido #${p.codigo} entregado.`,
    liberar: `El pedido #${p.codigo} quedó disponible para otro repartidor.`,
  };
  estado.ocupado.add(id);
  pintar();
  try {
    await funciones[nombre](id, estado.yo.id);
    estado.confirmando = null;
    avisar(mensajes[nombre]);
  } catch (err) {
    avisar(err.message);
  } finally {
    estado.ocupado.delete(id);
    await recargar();
  }
}

/* ---------- Eventos ---------- */

function activarEventos() {
  $('#trabajo').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-accion]');
    if (!b) return;
    const id = b.closest('.r-pedido')?.dataset.id;
    if (id) accion(b.dataset.accion, id);
  });
  $('#salir').addEventListener('click', salir);
  $('#actualizar').addEventListener('click', async () => {
    await recargar();
    avisar('Lista actualizada');
  });
  $('#ver-mapa').addEventListener('click', alternarMapa);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && estado.yo) {
      recargar();
      mantenerPantallaEncendida();
    }
  });
}

/* ---------- Utilidades ---------- */

async function mantenerPantallaEncendida() {
  try {
    await navigator.wakeLock?.request('screen');
  } catch {
    /* el navegador no lo permite */
  }
}

let temporizadorAviso;
function avisar(texto, vibrar = false) {
  const el = $('#aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (el.hidden = true), 3500);
  if (vibrar) {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* sin vibración */
    }
  }
}

function hace(fechaIso) {
  const min = Math.round((Date.now() - new Date(fechaIso).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h`;
}

function escapar(texto) {
  return String(texto ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

// Panel del restaurante (tablet): revisar comprobantes, aprobar o rechazar,
// avanzar estados, avisar por WhatsApp y abrir o cerrar la recepción de pedidos.

import { NOMBRES_PAGO } from './config.js';
import {
  cambiarEstado,
  cambiarRecepcion,
  cerrarSesion,
  escucharCambios,
  iniciarSesion,
  leerTienda,
  listarPedidos,
  modoDemo,
  sesionActiva,
  simularPedido,
  urlComprobante,
} from './panel-datos.js';

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const hora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const $ = (s) => document.querySelector(s);

const ESTADOS = {
  pago_por_revisar: { texto: 'Por revisar', clase: 'revisar' },
  en_preparacion: { texto: 'En preparación', clase: 'preparacion' },
  en_camino: { texto: 'En camino', clase: 'camino' },
  listo_para_recoger: { texto: 'Listo para recoger', clase: 'camino' },
  entregado: { texto: 'Entregado', clase: 'final' },
  rechazado: { texto: 'Rechazado', clase: 'rechazado' },
};

const FILTROS = {
  revisar: ['pago_por_revisar'],
  curso: ['en_preparacion', 'en_camino', 'listo_para_recoger'],
  finalizados: ['entregado', 'rechazado'],
};

const MOTIVOS = [
  'El comprobante no se ve bien',
  'El valor no coincide con el pedido',
  'No vemos el pago en la cuenta',
];

const CLAVE_VISTOS = 'delicia-china:panel-vistos';

const estado = {
  pedidos: [],
  filtro: 'revisar',
  seleccionado: null,
  conocidos: null, // ids ya cargados (para detectar pedidos nuevos)
  vistos: leerVistos(),
  sonido: false,
  tienda: { recibiendoPedidos: true },
  rechazando: false,
  mensajeEditado: false,
  costoDomicilio: '',
};

/* ---------- Arranque ---------- */

iniciar();

async function iniciar() {
  const demo = modoDemo();
  $('#etiqueta-demo').hidden = !demo;
  $('#simular').hidden = !demo;
  $('#nota-demo-ingreso').hidden = !demo;
  $('#campo-correo').hidden = demo;

  $('#form-ingreso').addEventListener('submit', entrar);
  activarEventos();

  if (await sesionActiva()) await abrirTrabajo();
  else mostrarPantalla('ingreso');
}

function mostrarPantalla(p) {
  document.body.dataset.pantalla = p;
  if (p === 'ingreso') setTimeout(() => (modoDemo() ? $('#i-clave') : $('#i-correo')).focus(), 0);
}

async function entrar(e) {
  e.preventDefault();
  const error = $('#error-ingreso');
  error.hidden = true;
  const boton = $('#entrar');
  boton.disabled = true;
  boton.textContent = 'Entrando…';
  try {
    await iniciarSesion($('#i-correo').value, $('#i-clave').value);
    $('#i-clave').value = '';
    await abrirTrabajo();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Entrar';
  }
}

let dejarDeEscuchar = null;
let intervalos = [];

async function abrirTrabajo() {
  mostrarPantalla('trabajo');
  await Promise.all([recargarPedidos(), recargarTienda()]);
  dejarDeEscuchar = await escucharCambios((tipo) => (tipo === 'tienda' ? recargarTienda() : recargarPedidos()));
  intervalos = [
    setInterval(recargarPedidos, 60000), // respaldo si se pierde la conexión en tiempo real
    setInterval(() => pintarLista(), 30000), // "hace X min"
    setInterval(repetirAlerta, 30000),
  ];
  mantenerPantallaEncendida();
}

async function salir() {
  dejarDeEscuchar?.();
  intervalos.forEach(clearInterval);
  await cerrarSesion();
  estado.pedidos = [];
  estado.conocidos = null;
  estado.seleccionado = null;
  mostrarPantalla('ingreso');
}

/* ---------- Carga ---------- */

async function recargarPedidos() {
  let lista;
  try {
    lista = await listarPedidos();
  } catch (err) {
    console.error(err);
    avisar('No se pudieron cargar los pedidos. Reintentando…');
    return;
  }
  const nuevos = estado.conocidos
    ? lista.filter((p) => !estado.conocidos.has(p.id) && p.estado === 'pago_por_revisar')
    : [];
  // Al abrir el panel, los pedidos que ya existían no suenan, pero los que nadie
  // ha abierto siguen marcados como "Nuevo" (ver esNuevo).
  estado.conocidos = new Set(lista.map((p) => p.id));
  estado.pedidos = lista;

  if (nuevos.length) {
    sonar();
    avisar(nuevos.length === 1 ? `Nuevo pedido #${nuevos[0].codigo}` : `${nuevos.length} pedidos nuevos`);
  }
  pintarLista();
  pintarDetalle({ conservarFormulario: true });
}

async function recargarTienda() {
  try {
    estado.tienda = await leerTienda();
  } catch (err) {
    console.error(err);
  }
  pintarRecepcion();
}

/* ---------- Lista ---------- */

function pedidosDelFiltro(filtro) {
  return estado.pedidos.filter((p) => FILTROS[filtro].includes(p.estado));
}

function esNuevo(p) {
  return p.estado === 'pago_por_revisar' && !estado.vistos.has(p.id);
}

function pintarLista() {
  for (const f of Object.keys(FILTROS)) {
    const n = pedidosDelFiltro(f).length;
    const cuenta = document.querySelector(`[data-cuenta="${f}"]`);
    cuenta.textContent = n;
    cuenta.classList.toggle('alerta', f === 'revisar' && n > 0);
  }
  document.querySelectorAll('.filtro').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.filtro === estado.filtro)));

  const lista = pedidosDelFiltro(estado.filtro).sort((a, b) =>
    estado.filtro === 'finalizados' ? b.actualizadoEn.localeCompare(a.actualizadoEn) : a.creadoEn.localeCompare(b.creadoEn),
  );

  const vacia = $('#lista-vacia');
  vacia.hidden = lista.length > 0;
  vacia.textContent = {
    revisar: 'No hay pagos por revisar. Los pedidos nuevos aparecen aquí.',
    curso: 'No hay pedidos en preparación ni en camino.',
    finalizados: 'Todavía no hay pedidos finalizados.',
  }[estado.filtro];

  $('#lista-pedidos').innerHTML = lista
    .map((p) => {
      const e = ESTADOS[p.estado];
      const unidades = p.items.reduce((s, i) => s + i.cantidad, 0);
      return `
        <li>
          <button type="button" class="tarjeta-pedido${p.id === estado.seleccionado ? ' activa' : ''}${esNuevo(p) ? ' nueva' : ''}" data-id="${p.id}">
            <span class="tp-fila">
              <span class="tp-cabeza">
                <strong class="tp-codigo">#${p.codigo}</strong>
                ${esNuevo(p) ? '<span class="tp-nuevo">Nuevo</span>' : ''}
              </span>
              <span class="tp-tiempo">${hace(p.creadoEn)}</span>
            </span>
            <span class="tp-nombre">${escapar(p.nombre)}</span>
            <span class="tp-fila">
              <span class="tp-entrega">${p.tipoEntrega === 'domicilio' ? 'Domicilio' : 'Recoger'} · ${unidades} ${unidades === 1 ? 'producto' : 'productos'}</span>
              <strong class="tp-total">${pesos.format(p.total)}</strong>
            </span>
            ${estado.filtro === 'revisar' ? '' : `<span class="pastilla-estado ${e.clase}">${e.texto}</span>`}
          </button>
        </li>`;
    })
    .join('');

  const nuevos = estado.pedidos.filter(esNuevo).length;
  document.title = nuevos ? `(${nuevos}) Pedidos nuevos · Delicia China` : 'Panel · Delicia China';
}

/* ---------- Detalle ---------- */

function pedidoSeleccionado() {
  return estado.pedidos.find((p) => p.id === estado.seleccionado) ?? null;
}

function seleccionar(id) {
  if (estado.seleccionado !== id) {
    estado.rechazando = false;
    estado.mensajeEditado = false;
    estado.costoDomicilio = '';
  }
  estado.seleccionado = id;
  marcarVisto(id);
  document.body.classList.add('detalle-abierto');
  pintarLista();
  pintarDetalle();
  $('#detalle').scrollTop = 0;
  $('#titulo-detalle')?.focus({ preventScroll: true });
}

function cerrarDetalle() {
  document.body.classList.remove('detalle-abierto');
  const tarjeta = document.querySelector(`.tarjeta-pedido[data-id="${estado.seleccionado}"]`);
  tarjeta?.focus();
}

async function pintarDetalle({ conservarFormulario = false } = {}) {
  const contenedor = $('#detalle');
  const p = pedidoSeleccionado();
  if (!p) {
    contenedor.innerHTML = `<div class="detalle-vacio"><p>Elige un pedido de la lista para ver el detalle y el comprobante.</p></div>`;
    document.body.classList.remove('detalle-abierto');
    return;
  }

  // No borrar lo que el empleado está escribiendo si llega una actualización.
  const motivoEscrito = conservarFormulario ? $('#motivo-rechazo')?.value : null;
  const mensajeEscrito = conservarFormulario && estado.mensajeEditado ? $('#mensaje-wa')?.value : null;
  const focoId = conservarFormulario && contenedor.contains(document.activeElement) ? document.activeElement.id : null;

  const e = ESTADOS[p.estado];
  const telVisible = `${p.telefono.slice(0, 3)} ${p.telefono.slice(3, 6)} ${p.telefono.slice(6)}`;

  contenedor.innerHTML = `
    <div class="detalle-cabecera">
      <button type="button" class="volver solo-angosto" data-accion="cerrar-detalle">← Pedidos</button>
      <div class="detalle-titulo">
        <h2 id="titulo-detalle" tabindex="-1">Pedido #${p.codigo}</h2>
        <span class="pastilla-estado ${e.clase}">${e.texto}</span>
      </div>
      <p class="detalle-hora">Recibido a las ${hora.format(new Date(p.creadoEn))} · ${hace(p.creadoEn)}${p.ejemplo ? ' · <span class="etiqueta-demo">Ejemplo</span>' : ''}</p>
    </div>

    <div class="detalle-rejilla">
      <div class="detalle-col">
        <section class="tarjeta">
          <h3>Cliente</h3>
          <p class="cliente-nombre">${escapar(p.nombre)}</p>
          <p class="cliente-tel"><span class="seleccionable">${telVisible}</span></p>
          <p class="cliente-entrega"><strong>${p.tipoEntrega === 'domicilio' ? 'Domicilio' : 'Recoge en el local'}</strong>${
            p.direccion ? `<br />${escapar(p.direccion)}` : ''
          }</p>
          ${p.notas ? `<p class="cliente-notas">“${escapar(p.notas)}”</p>` : ''}
        </section>

        <section class="tarjeta">
          <h3>Platos</h3>
          <ul class="items">
            ${p.items
              .map(
                (i) => `
              <li>
                <span class="i-cant">${i.cantidad}×</span>
                <span class="i-nombre">${escapar(i.nombre)}
                  ${i.opciones.length ? `<span class="i-op">${i.opciones.map(escapar).join(' · ')}</span>` : ''}
                  ${i.nota ? `<span class="i-nota">“${escapar(i.nota)}”</span>` : ''}
                </span>
                <span class="i-valor">${pesos.format(i.precio * i.cantidad)}</span>
              </li>`,
              )
              .join('')}
          </ul>
          <div class="fila-total"><span>Total pagado</span><strong>${pesos.format(p.total)}</strong></div>
          ${p.tipoEntrega === 'domicilio' ? '<p class="nota">Sin domicilio. El costo se acuerda por WhatsApp.</p>' : ''}
        </section>
      </div>

      <div class="detalle-col">
        <section class="tarjeta">
          <h3>Comprobante · ${NOMBRES_PAGO[p.metodoPago] ?? p.metodoPago}</h3>
          <button type="button" class="miniatura" data-accion="ver-comprobante" aria-label="Ver comprobante en grande">
            <span class="cargando-img">Cargando comprobante…</span>
          </button>
          <p class="nota">Revisa que el valor sea ${pesos.format(p.total)} y que el pago esté a nombre del restaurante.</p>
        </section>

        ${htmlAcciones(p)}
        ${htmlMensaje(p)}
      </div>
    </div>`;

  if (motivoEscrito != null && $('#motivo-rechazo')) $('#motivo-rechazo').value = motivoEscrito;
  if (mensajeEscrito != null && $('#mensaje-wa')) {
    $('#mensaje-wa').value = mensajeEscrito;
    actualizarEnlaceWa();
  }
  if (focoId) document.getElementById(focoId)?.focus({ preventScroll: true });

  const url = await urlComprobante(p);
  if (pedidoSeleccionado()?.id !== p.id) return;
  const mini = contenedor.querySelector('.miniatura');
  if (!mini) return;
  mini.innerHTML = url
    ? `<img src="${url}" alt="Comprobante del pedido #${p.codigo}" />`
    : '<span class="cargando-img">No se pudo cargar el comprobante.</span>';
  mini.dataset.url = url ?? '';
}

function htmlAcciones(p) {
  if (p.estado === 'pago_por_revisar' && estado.rechazando) {
    return `
      <section class="tarjeta tarjeta-acciones">
        <h3>Rechazar pago</h3>
        <div class="motivos">
          ${MOTIVOS.map((m) => `<button type="button" class="chip-motivo" data-motivo="${escapar(m)}">${escapar(m)}</button>`).join('')}
        </div>
        <div class="campo">
          <label for="motivo-rechazo">Motivo (lo verá el cliente)</label>
          <textarea id="motivo-rechazo" rows="2" maxlength="200"></textarea>
        </div>
        <div class="fila-botones">
          <button type="button" class="boton-secundario" data-accion="cancelar-rechazo">Cancelar</button>
          <button type="button" class="boton-peligro" data-accion="confirmar-rechazo">Confirmar rechazo</button>
        </div>
      </section>`;
  }

  const botones = {
    pago_por_revisar: `
      <button type="button" class="boton-principal boton-grande" data-accion="estado" data-estado="en_preparacion">Aprobar pago</button>
      <button type="button" class="boton-secundario" data-accion="rechazar">Rechazar</button>`,
    en_preparacion:
      p.tipoEntrega === 'domicilio'
        ? `<button type="button" class="boton-principal boton-grande" data-accion="estado" data-estado="en_camino">Marcar en camino</button>`
        : `<button type="button" class="boton-principal boton-grande" data-accion="estado" data-estado="listo_para_recoger">Marcar listo para recoger</button>`,
    en_camino: `<button type="button" class="boton-principal boton-grande" data-accion="estado" data-estado="entregado">Marcar entregado</button>`,
    listo_para_recoger: `<button type="button" class="boton-principal boton-grande" data-accion="estado" data-estado="entregado">Marcar entregado</button>`,
    entregado: '',
    rechazado: `<p class="nota">Motivo: ${escapar(p.motivoRechazo ?? 'sin motivo')}</p>
      <button type="button" class="boton-secundario" data-accion="estado" data-estado="pago_por_revisar">Volver a revisar</button>`,
  }[p.estado];

  if (!botones) return '';
  return `<section class="tarjeta tarjeta-acciones"><div class="fila-botones">${botones}</div></section>`;
}

function textoMensaje(p) {
  const nombre = p.nombre.split(' ')[0];
  const saludo = `Hola ${nombre}, te escribimos de Delicia China.`;
  switch (p.estado) {
    case 'pago_por_revisar':
      return `${saludo} Recibimos tu pedido #${p.codigo} y estamos revisando tu comprobante. Te confirmamos en unos minutos.`;
    case 'en_preparacion': {
      const total = pesos.format(p.total);
      if (p.tipoEntrega === 'domicilio') {
        const costo = Number(estado.costoDomicilio) > 0 ? pesos.format(Number(estado.costoDomicilio)) : null;
        return `${saludo} Confirmamos tu pago de ${total}. Tu pedido #${p.codigo} ya está en preparación.${
          costo ? ` El domicilio a ${p.direccion} tiene un costo de ${costo}, que pagas al recibir.` : ''
        } Te avisamos cuando salga. ¡Gracias por tu compra!`;
      }
      return `${saludo} Confirmamos tu pago de ${total}. Tu pedido #${p.codigo} ya está en preparación. Te avisamos cuando esté listo para recoger. ¡Gracias por tu compra!`;
    }
    case 'en_camino':
      return `${saludo} Tu pedido #${p.codigo} ya va en camino a ${p.direccion}.`;
    case 'listo_para_recoger':
      return `${saludo} Tu pedido #${p.codigo} está listo. Puedes pasar a recogerlo al local.`;
    case 'rechazado':
      return `${saludo} No pudimos confirmar el pago de tu pedido #${p.codigo}: ${minusculaInicial(
        (p.motivoRechazo ?? 'el comprobante no es válido').replace(/\.$/, ''),
      )}. Respóndenos este mensaje y te ayudamos a resolverlo.`;
    default:
      return '';
  }
}

function htmlMensaje(p) {
  if (p.estado === 'entregado' || (p.estado === 'pago_por_revisar' && estado.rechazando)) return '';
  const costo =
    p.estado === 'en_preparacion' && p.tipoEntrega === 'domicilio'
      ? `<div class="campo campo-costo">
          <label for="costo-domicilio">Costo del domicilio <small>(opcional, se agrega al mensaje)</small></label>
          <input id="costo-domicilio" type="number" inputmode="numeric" min="0" step="500" placeholder="Ej.: 4000" value="${escapar(estado.costoDomicilio)}" />
        </div>`
      : '';
  const texto = textoMensaje(p);
  return `
    <section class="tarjeta tarjeta-mensaje">
      <h3>Mensaje para el cliente</h3>
      ${costo}
      <div class="campo">
        <label class="solo-lector" for="mensaje-wa">Texto del mensaje</label>
        <textarea id="mensaje-wa" rows="4">${escapar(texto)}</textarea>
      </div>
      <a id="enlace-wa" class="boton-whatsapp" href="${enlaceWa(p.telefono, texto)}" target="_blank" rel="noopener">
        Abrir WhatsApp con el mensaje
      </a>
      <p class="nota">Se abre el chat con ${p.telefono.slice(0, 3)} ${p.telefono.slice(3, 6)} ${p.telefono.slice(6)}. Revisa el texto y pulsa enviar en WhatsApp.</p>
    </section>`;
}

function enlaceWa(telefono, texto) {
  return `https://wa.me/57${telefono}?text=${encodeURIComponent(texto)}`;
}

function actualizarEnlaceWa() {
  const p = pedidoSeleccionado();
  const enlace = $('#enlace-wa');
  if (p && enlace) enlace.href = enlaceWa(p.telefono, $('#mensaje-wa').value);
}

/* ---------- Acciones ---------- */

async function aplicarEstado(nuevo, motivo = null) {
  const p = pedidoSeleccionado();
  if (!p) return;
  const botones = document.querySelectorAll('#detalle .tarjeta-acciones button');
  botones.forEach((b) => (b.disabled = true));
  try {
    await cambiarEstado(p.id, nuevo, motivo);
    // Actualización inmediata en pantalla; la recarga confirma.
    p.estado = nuevo;
    p.motivoRechazo = motivo;
    p.actualizadoEn = new Date().toISOString();
    estado.rechazando = false;
    estado.mensajeEditado = false;
    pintarLista();
    pintarDetalle();
    avisar(`Pedido #${p.codigo}: ${ESTADOS[nuevo].texto.toLowerCase()}`);
    const tarjetaMensaje = $('#mensaje-wa')?.closest('.tarjeta');
    if (tarjetaMensaje) {
      tarjetaMensaje.classList.add('resaltar');
      tarjetaMensaje.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } catch (err) {
    avisar(err.message);
    botones.forEach((b) => (b.disabled = false));
  }
}

async function alternarRecepcion() {
  const abrir = !estado.tienda.recibiendoPedidos;
  try {
    await cambiarRecepcion(abrir);
    estado.tienda.recibiendoPedidos = abrir;
    pintarRecepcion();
    avisar(abrir ? 'Recepción de pedidos abierta' : 'Recepción de pedidos cerrada');
  } catch (err) {
    avisar(err.message);
  }
}

function pintarRecepcion() {
  const abierto = estado.tienda.recibiendoPedidos;
  const boton = $('#recepcion');
  boton.setAttribute('aria-checked', String(abierto));
  $('#texto-recepcion').textContent = abierto ? 'Recibiendo pedidos' : 'Pedidos cerrados';
  $('#aviso-cerrado-panel').hidden = abierto;
}

function abrirVisor(url) {
  if (!url) return;
  $('#imagen-visor').src = url;
  $('#visor').hidden = false;
  $('#cerrar-visor').focus();
}

function cerrarVisor() {
  $('#visor').hidden = true;
  document.querySelector('#detalle .miniatura')?.focus();
}

/* ---------- Sonido ---------- */

let audio = null;

function activarSonido() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    estado.sonido = true;
    sonar();
  } catch {
    avisar('Este navegador no permite reproducir sonido.');
  }
  pintarSonido();
}

function alternarSonido() {
  if (estado.sonido) {
    estado.sonido = false;
    pintarSonido();
  } else activarSonido();
}

function pintarSonido() {
  const b = $('#sonido');
  b.setAttribute('aria-pressed', String(estado.sonido));
  $('#texto-sonido').textContent = estado.sonido ? 'Sonido activo' : 'Activar sonido';
  b.classList.toggle('pendiente', !estado.sonido);
}

// Dos notas cortas tipo campana, generadas sin archivos de audio.
function sonar() {
  if (!estado.sonido || !audio) return;
  const t = audio.currentTime;
  [
    [880, 0],
    [1318.5, 0.18],
  ].forEach(([frecuencia, inicio]) => {
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    vol.gain.setValueAtTime(0.0001, t + inicio);
    vol.gain.exponentialRampToValueAtTime(0.35, t + inicio + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + inicio + 0.9);
    osc.connect(vol).connect(audio.destination);
    osc.start(t + inicio);
    osc.stop(t + inicio + 1);
  });
}

function repetirAlerta() {
  if (estado.pedidos.some(esNuevo)) sonar();
}

/* ---------- Pantalla encendida ---------- */

let bloqueo = null;
async function mantenerPantallaEncendida() {
  try {
    bloqueo = await navigator.wakeLock?.request('screen');
  } catch {
    /* el navegador no lo permite; no pasa nada */
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.body.dataset.pantalla === 'trabajo') {
    mantenerPantallaEncendida();
    recargarPedidos();
  }
});

/* ---------- Eventos ---------- */

function activarEventos() {
  $('#lista-pedidos').addEventListener('click', (e) => {
    const t = e.target.closest('.tarjeta-pedido');
    if (t) seleccionar(t.dataset.id);
  });

  document.querySelector('.filtros').addEventListener('click', (e) => {
    const b = e.target.closest('.filtro');
    if (!b) return;
    estado.filtro = b.dataset.filtro;
    pintarLista();
  });

  $('#detalle').addEventListener('click', (e) => {
    const motivo = e.target.closest('[data-motivo]');
    if (motivo) {
      $('#motivo-rechazo').value = motivo.dataset.motivo;
      $('#motivo-rechazo').focus();
      return;
    }
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const accion = b.dataset.accion;
    if (accion === 'estado') aplicarEstado(b.dataset.estado);
    else if (accion === 'rechazar') {
      estado.rechazando = true;
      pintarDetalle();
      $('#motivo-rechazo')?.focus();
    } else if (accion === 'cancelar-rechazo') {
      estado.rechazando = false;
      pintarDetalle();
    } else if (accion === 'confirmar-rechazo') {
      const motivo = $('#motivo-rechazo').value.trim();
      if (!motivo) {
        avisar('Elige o escribe el motivo del rechazo.');
        $('#motivo-rechazo').focus();
        return;
      }
      aplicarEstado('rechazado', motivo);
    } else if (accion === 'ver-comprobante') abrirVisor(b.dataset.url);
    else if (accion === 'cerrar-detalle') cerrarDetalle();
  });

  $('#detalle').addEventListener('input', (e) => {
    if (e.target.id === 'mensaje-wa') {
      estado.mensajeEditado = true;
      actualizarEnlaceWa();
    } else if (e.target.id === 'costo-domicilio') {
      estado.costoDomicilio = e.target.value;
      if (!estado.mensajeEditado) {
        $('#mensaje-wa').value = textoMensaje(pedidoSeleccionado());
        actualizarEnlaceWa();
      }
    }
  });

  $('#recepcion').addEventListener('click', alternarRecepcion);
  $('#sonido').addEventListener('click', alternarSonido);
  $('#simular').addEventListener('click', () => {
    simularPedido();
    // En el modo demo, el aviso del almacén dispara la recarga y la alerta.
  });
  $('#salir').addEventListener('click', salir);
  $('#cerrar-visor').addEventListener('click', cerrarVisor);
  $('#visor').addEventListener('click', (e) => {
    if (e.target.id === 'visor') cerrarVisor();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#visor').hidden) cerrarVisor();
    else if (document.body.classList.contains('detalle-abierto')) cerrarDetalle();
  });

  // Cualquier toque cuenta como interacción: intentar activar el sonido solo una vez.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!estado.sonido && document.body.dataset.pantalla === 'trabajo' && !e.target.closest('#sonido')) activarSonido();
    },
    { once: true },
  );
  pintarSonido();
}

/* ---------- Utilidades ---------- */

function marcarVisto(id) {
  estado.vistos.add(id);
  try {
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify([...estado.vistos].slice(-300)));
  } catch {
    /* nada */
  }
}

function leerVistos() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTOS) ?? '[]'));
  } catch {
    return new Set();
  }
}

function hace(fechaIso) {
  const min = Math.round((Date.now() - new Date(fechaIso).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(fechaIso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function minusculaInicial(texto) {
  return texto ? texto[0].toLowerCase() + texto.slice(1) : texto;
}

function escapar(texto) {
  return String(texto ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

let temporizadorAviso;
function avisar(texto) {
  const el = $('#aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (el.hidden = true), 3500);
}

// Pantalla del cliente: menú por categorías, búsqueda, carrito y navegación entre vistas.
// Vistas: "menu" (sin #), "pedido" (#pedido) y "listo" (#listo).

import { CONFIG } from './config.js';
import { cargarMenu } from './datos.js';
import { crearCarrito } from './carrito.js';
import { iniciarCheckout } from './checkout.js';

const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const $ = (sel) => document.querySelector(sel);

const el = {
  estado: $('#estado-tienda'),
  horario: $('#horario'),
  avisoDemo: $('#aviso-demo'),
  avisoCerrado: $('#aviso-cerrado'),
  buscador: $('#buscador'),
  limpiarBusqueda: $('#limpiar-busqueda'),
  categorias: $('#categorias'),
  menu: $('#menu'),
  sinResultados: $('#sin-resultados'),
  textoSinResultados: $('#texto-sin-resultados'),
  barraCarrito: $('#barra-carrito'),
  barraCantidad: $('#barra-cantidad'),
  barraTotal: $('#barra-total'),
  hoja: $('#hoja-carrito'),
  fondoHoja: $('#fondo-hoja'),
  lineas: $('#lineas-carrito'),
  subtotal: $('#subtotal'),
  continuar: $('#continuar'),
  vaciar: $('#vaciar'),
  cerrarHoja: $('#cerrar-hoja'),
  aviso: $('#aviso'),
};

const carrito = crearCarrito();
let datos = null;
let platosPorId = new Map();
let checkout = null;
const editoresAbiertos = new Set();

iniciar();

async function iniciar() {
  try {
    datos = await cargarMenu();
  } catch (error) {
    console.error(error);
    el.menu.innerHTML =
      '<p class="error-carga">No se pudo cargar el menú. Revisa tu conexión y vuelve a abrir la página.</p>';
    return;
  }

  platosPorId = new Map(datos.platos.map((p) => [p.id, p]));
  carrito.limpiar(platosPorId, datos.opciones);

  checkout = iniciarCheckout({ datos, carrito, platosPorId, pesos, escapar, avisar, irAlMenu, mostrarListo });

  pintarEstadoTienda();
  pintarCategorias();
  pintarMenu();
  pintarCarrito();
  activarEventos();
  observarSecciones();
  mostrarVista();
}

/* ---------- Vistas ---------- */

let vistaActual = 'menu';
let posicionMenu = 0;

function mostrarVista() {
  let vista = location.hash.slice(1) || 'menu';
  if (!['menu', 'pedido', 'listo'].includes(vista)) vista = 'menu';
  if (vista === 'pedido' && (!carrito.lineas(platosPorId).length || !datos.tienda.recibiendoPedidos)) vista = 'menu';
  if (vista === 'listo' && !checkout.hayConfirmacion()) vista = 'menu';
  if (vista === 'menu' && location.hash) limpiarHash();

  if (vistaActual === 'menu' && vista !== 'menu') posicionMenu = window.scrollY;
  const anterior = vistaActual;
  vistaActual = vista;
  document.body.dataset.vista = vista;

  if (vista === 'pedido') {
    checkout.pintar();
    window.scrollTo(0, 0);
    $('#titulo-pedido').focus({ preventScroll: true });
  } else if (vista === 'listo') {
    checkout.alMostrarListo();
    window.scrollTo(0, 0);
    $('#titulo-listo').focus({ preventScroll: true });
  } else if (anterior !== 'menu') {
    window.scrollTo(0, anterior === 'pedido' ? posicionMenu : 0);
  }
}

function irAlPedido() {
  cerrarHoja({ devolverFoco: false });
  location.hash = 'pedido';
}

function irAlMenu() {
  limpiarHash();
  mostrarVista();
}

function mostrarListo() {
  location.replace('#listo');
}

function limpiarHash() {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    location.hash = '';
  }
}

/* ---------- Estado de la tienda ---------- */

function pintarEstadoTienda() {
  const abierto = datos.tienda.recibiendoPedidos;
  el.estado.textContent = abierto ? 'Recibiendo pedidos' : 'Cerrado por ahora';
  el.estado.dataset.abierto = String(abierto);
  el.horario.textContent = datos.tienda.horarioTexto;
  el.avisoCerrado.hidden = abierto;
  el.avisoDemo.hidden = datos.origen !== 'demo';
  el.continuar.disabled = !abierto;
  document.body.classList.toggle('tienda-cerrada', !abierto);
}

/* ---------- Categorías ---------- */

function pintarCategorias() {
  const conPlatos = datos.categorias.filter((c) => datos.platos.some((p) => p.categoriaId === c.id));
  el.categorias.innerHTML = conPlatos
    .map(
      (c, i) =>
        `<a class="chip${i === 0 ? ' activa' : ''}" href="#cat-${c.id}" data-cat="${c.id}">${escapar(c.nombre)}</a>`,
    )
    .join('');
}

function marcarCategoria(id) {
  let activa = null;
  el.categorias.querySelectorAll('.chip').forEach((chip) => {
    const es = chip.dataset.cat === id;
    chip.classList.toggle('activa', es);
    if (es) activa = chip;
  });
  if (activa) {
    const nav = el.categorias;
    const izquierda = activa.offsetLeft - nav.clientWidth / 2 + activa.clientWidth / 2;
    nav.scrollTo({ left: izquierda, behavior: preferirMovimiento() ? 'smooth' : 'auto' });
  }
}

let bloquearSeguimiento = false;

function observarSecciones() {
  const observador = new IntersectionObserver(
    (entradas) => {
      if (bloquearSeguimiento || vistaActual !== 'menu' || el.buscador.value.trim()) return;
      const visibles = entradas.filter((e) => e.isIntersecting);
      if (visibles.length) {
        const primera = visibles.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        marcarCategoria(primera.target.dataset.cat);
      }
    },
    { rootMargin: '-140px 0px -60% 0px' },
  );
  el.menu.querySelectorAll('.seccion').forEach((s) => observador.observe(s));
}

/* ---------- Menú ---------- */

function pintarMenu() {
  el.menu.innerHTML = datos.categorias
    .map((cat) => {
      const platos = datos.platos.filter((p) => p.categoriaId === cat.id);
      if (!platos.length) return '';
      return `
        <section class="seccion" id="cat-${cat.id}" data-cat="${cat.id}" aria-labelledby="titulo-${cat.id}">
          <h2 class="titulo-seccion" id="titulo-${cat.id}">
            <span>${escapar(cat.nombre)}</span>
            <small>${platos.length} ${platos.length === 1 ? 'plato' : 'platos'}</small>
          </h2>
          <div class="lista-platos">
            ${platos.map(htmlPlato).join('')}
          </div>
        </section>`;
    })
    .join('');
}

function htmlPlato(p) {
  return `
    <article class="plato${carrito.cantidad(p.id) ? ' en-carrito' : ''}" data-id="${p.id}" data-busqueda="${escapar(normalizar(p.nombre + ' ' + p.descripcion))}">
      <div class="plato-texto">
        <h3>${escapar(p.nombre)}</h3>
        <p>${escapar(p.descripcion)}</p>
        <span class="precio">${pesos.format(p.precio)}</span>
      </div>
      <div class="plato-control">${htmlControl(p)}</div>
    </article>`;
}

function htmlControl(p) {
  const n = carrito.cantidad(p.id);
  const cerrado = !datos.tienda.recibiendoPedidos;
  if (n === 0) {
    return `<button type="button" class="boton-agregar" data-accion="sumar" ${cerrado ? 'disabled' : ''}
      aria-label="Agregar ${escapar(p.nombre)}">Agregar</button>`;
  }
  return htmlContador(p, n);
}

function htmlContador(p, n) {
  return `
    <div class="contador" role="group" aria-label="Cantidad de ${escapar(p.nombre)}">
      <button type="button" data-accion="restar" aria-label="Quitar uno">−</button>
      <output aria-live="polite">${n}</output>
      <button type="button" data-accion="sumar" aria-label="Agregar uno" ${n >= 50 ? 'disabled' : ''}>+</button>
    </div>`;
}

function refrescarPlato(id) {
  const tarjeta = el.menu.querySelector(`.plato[data-id="${id}"]`);
  if (!tarjeta) return;
  const control = tarjeta.querySelector('.plato-control');
  control.innerHTML = htmlControl(platosPorId.get(id));
  tarjeta.classList.toggle('en-carrito', carrito.cantidad(id) > 0);
  // Si el cambio vino de un clic en esta tarjeta, el foco sigue en el botón equivalente.
  if (tarjeta.dataset.foco) {
    const objetivo = control.querySelector(`[data-accion="${tarjeta.dataset.foco}"]`) ?? control.querySelector('button');
    objetivo?.focus({ preventScroll: true });
    delete tarjeta.dataset.foco;
  }
}

/* ---------- Búsqueda ---------- */

function filtrar() {
  const q = normalizar(el.buscador.value.trim());
  el.limpiarBusqueda.hidden = !q;
  document.body.classList.toggle('buscando', Boolean(q));
  let total = 0;

  el.menu.querySelectorAll('.seccion').forEach((seccion) => {
    let visibles = 0;
    seccion.querySelectorAll('.plato').forEach((plato) => {
      const coincide = !q || q.split(/\s+/).every((t) => plato.dataset.busqueda.includes(t));
      plato.hidden = !coincide;
      if (coincide) visibles++;
    });
    seccion.hidden = visibles === 0;
    total += visibles;
  });

  el.sinResultados.hidden = total > 0;
  if (!total) el.textoSinResultados.textContent = `No hay platos que coincidan con “${el.buscador.value.trim()}”.`;
}

/* ---------- Carrito ---------- */

function textoDetalle(opciones, nota) {
  const partes = [...opciones];
  if (nota.trim()) partes.push(`“${nota.trim()}”`);
  return partes.join(' · ');
}

function pintarCarrito() {
  const lineas = carrito.lineas(platosPorId);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const total = lineas.reduce((s, l) => s + l.cantidad * l.plato.precio, 0);

  el.barraCarrito.hidden = unidades === 0;
  document.body.classList.toggle('con-carrito', unidades > 0);
  el.barraCantidad.textContent = `${unidades} ${unidades === 1 ? 'producto' : 'productos'}`;
  el.barraTotal.textContent = pesos.format(total);
  el.subtotal.textContent = pesos.format(total);

  // Recordar el foco para no perderlo al volver a pintar la lista.
  const foco = document.activeElement;
  const focoId = el.lineas.contains(foco) ? foco.id || null : null;
  const focoAccion = el.lineas.contains(foco) ? foco.dataset?.accion : null;
  const focoLinea = el.lineas.contains(foco) ? foco.closest('.linea')?.dataset.id : null;

  for (const id of [...editoresAbiertos]) if (!carrito.cantidad(Number(id))) editoresAbiertos.delete(id);

  el.lineas.innerHTML = lineas.length
    ? lineas.map(htmlLinea).join('')
    : '<li class="linea-vacia">Tu pedido está vacío. Agrega platos desde el menú.</li>';

  if (focoLinea) {
    const linea = el.lineas.querySelector(`.linea[data-id="${focoLinea}"]`);
    const destino =
      (focoId && document.getElementById(focoId)) ||
      (focoAccion && linea?.querySelector(`[data-accion="${focoAccion}"]`)) ||
      linea?.querySelector('button');
    destino?.focus({ preventScroll: true });
  }

  if (!lineas.length && !el.hoja.hidden) cerrarHoja();
}

function htmlLinea({ plato, cantidad, opciones, nota }) {
  const id = plato.id;
  const abierto = editoresAbiertos.has(String(id));
  const detalle = textoDetalle(opciones, nota);
  const casillas = datos.opciones
    .map(
      (op, i) => `
        <label class="casilla" for="op-${id}-${i}">
          <input type="checkbox" id="op-${id}-${i}" value="${escapar(op)}" ${opciones.includes(op) ? 'checked' : ''} />
          <span>${escapar(op)}</span>
        </label>`,
    )
    .join('');
  return `
    <li class="linea" data-id="${id}">
      <div class="linea-texto">
        <span class="linea-nombre">${escapar(plato.nombre)}</span>
        <span class="linea-precio">${pesos.format(plato.precio)} c/u</span>
        <span class="linea-detalle"${detalle ? '' : ' hidden'}>${escapar(detalle)}</span>
      </div>
      <span class="linea-total">${pesos.format(plato.precio * cantidad)}</span>
      <div class="linea-acciones">
        ${htmlContador(plato, cantidad)}
        <button type="button" id="abrir-op-${id}" class="enlace-opciones" data-accion="opciones"
          aria-expanded="${abierto}" aria-controls="editor-${id}">${abierto ? 'Listo' : 'Opciones y notas'}</button>
      </div>
      <div class="editor-opciones" id="editor-${id}"${abierto ? '' : ' hidden'}>
        ${casillas ? `<fieldset><legend>Opciones</legend><div class="casillas">${casillas}</div></fieldset>` : ''}
        <label class="campo-nota" for="nota-${id}">
          <span>Nota para la cocina <small>(opcional)</small></span>
          <textarea id="nota-${id}" rows="2" maxlength="200" placeholder="Ej.: bien cocido, sin sal">${escapar(nota)}</textarea>
        </label>
      </div>
    </li>`;
}

function guardarPersonalizacion(linea) {
  const id = Number(linea.dataset.id);
  const opciones = [...linea.querySelectorAll('.casillas input:checked')].map((c) => c.value);
  const nota = linea.querySelector('textarea')?.value ?? '';
  carrito.personalizar(id, { opciones, nota });
  const detalle = linea.querySelector('.linea-detalle');
  const texto = textoDetalle(opciones, nota);
  detalle.textContent = texto;
  detalle.hidden = !texto;
}

function abrirHoja() {
  el.hoja.hidden = false;
  el.fondoHoja.hidden = false;
  document.body.classList.add('hoja-abierta');
  el.cerrarHoja.focus();
}

function cerrarHoja({ devolverFoco = true } = {}) {
  el.hoja.hidden = true;
  el.fondoHoja.hidden = true;
  document.body.classList.remove('hoja-abierta');
  if (devolverFoco && !el.barraCarrito.hidden) el.barraCarrito.focus({ preventScroll: true });
}

let temporizadorAviso;
function avisar(texto) {
  el.aviso.textContent = texto;
  el.aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (el.aviso.hidden = true), 3500);
}

/* ---------- Eventos ---------- */

function activarEventos() {
  carrito.alCambiar(pintarCarrito);

  el.menu.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;
    const tarjeta = boton.closest('.plato');
    const id = Number(tarjeta.dataset.id);
    tarjeta.dataset.foco =
      boton.dataset.accion === 'restar' && carrito.cantidad(id) === 1 ? 'sumar' : boton.dataset.accion;
    carrito.cambiar(id, boton.dataset.accion === 'sumar' ? 1 : -1);
    refrescarPlato(id);
  });

  el.lineas.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;
    const linea = boton.closest('.linea');
    const id = linea.dataset.id;

    if (boton.dataset.accion === 'opciones') {
      const editor = linea.querySelector('.editor-opciones');
      const abrir = editor.hidden;
      editor.hidden = !abrir;
      boton.setAttribute('aria-expanded', String(abrir));
      boton.textContent = abrir ? 'Listo' : 'Opciones y notas';
      if (abrir) editoresAbiertos.add(id);
      else editoresAbiertos.delete(id);
      return;
    }

    carrito.cambiar(Number(id), boton.dataset.accion === 'sumar' ? 1 : -1);
    refrescarPlato(Number(id));
  });

  el.lineas.addEventListener('change', (e) => {
    const linea = e.target.closest('.linea');
    if (linea && e.target.matches('input[type="checkbox"]')) guardarPersonalizacion(linea);
  });
  el.lineas.addEventListener('input', (e) => {
    const linea = e.target.closest('.linea');
    if (linea && e.target.matches('textarea')) guardarPersonalizacion(linea);
  });

  el.categorias.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    e.preventDefault();
    if (el.buscador.value) {
      el.buscador.value = '';
      filtrar();
    }
    const destino = document.getElementById(`cat-${chip.dataset.cat}`);
    marcarCategoria(chip.dataset.cat);
    bloquearSeguimiento = true;
    destino.scrollIntoView({ behavior: preferirMovimiento() ? 'smooth' : 'auto', block: 'start' });
    setTimeout(() => (bloquearSeguimiento = false), 700);
  });

  el.buscador.addEventListener('input', filtrar);
  el.limpiarBusqueda.addEventListener('click', () => {
    el.buscador.value = '';
    filtrar();
    el.buscador.focus();
  });

  el.barraCarrito.addEventListener('click', abrirHoja);
  el.cerrarHoja.addEventListener('click', () => cerrarHoja());
  el.fondoHoja.addEventListener('click', () => cerrarHoja());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hoja.hidden) cerrarHoja();
  });

  el.vaciar.addEventListener('click', () => {
    const ids = carrito.lineas(platosPorId).map((l) => l.plato.id);
    carrito.vaciar();
    ids.forEach(refrescarPlato);
  });

  el.continuar.addEventListener('click', irAlPedido);
  window.addEventListener('hashchange', mostrarVista);

  // Si se vacía el carrito o se envía el pedido, las tarjetas del menú se actualizan.
  carrito.alCambiar(() => {
    el.menu.querySelectorAll('.plato.en-carrito').forEach((t) => {
      if (!carrito.cantidad(Number(t.dataset.id))) refrescarPlato(Number(t.dataset.id));
    });
  });
}

/* ---------- Utilidades ---------- */

function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escapar(texto) {
  return String(texto).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

function preferirMovimiento() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

document.title = `${CONFIG.nombre} · Pedidos`;

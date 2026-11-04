// Pantalla del cliente: menú por categorías, búsqueda y carrito.

import { CONFIG } from './config.js';
import { cargarMenu } from './datos.js';
import { crearCarrito } from './carrito.js';

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
  carrito.limpiar(platosPorId);

  pintarEstadoTienda();
  pintarCategorias();
  pintarMenu();
  pintarCarrito();
  activarEventos();
  observarSecciones();
}

/* ---------- Estado de la tienda ---------- */

function pintarEstadoTienda() {
  const abierto = datos.tienda.recibiendoPedidos;
  el.estado.textContent = abierto ? 'Recibiendo pedidos' : 'Cerrado por ahora';
  el.estado.dataset.abierto = String(abierto);
  el.horario.textContent = datos.tienda.horarioTexto;
  el.avisoCerrado.hidden = abierto;
  el.avisoDemo.hidden = datos.origen !== 'demo';
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
  const chips = el.categorias.querySelectorAll('.chip');
  let activa = null;
  chips.forEach((chip) => {
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
      if (bloquearSeguimiento || el.buscador.value.trim()) return;
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

function pintarCarrito() {
  const lineas = carrito.lineas(platosPorId);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const total = lineas.reduce((s, l) => s + l.cantidad * l.plato.precio, 0);

  el.barraCarrito.hidden = unidades === 0;
  document.body.classList.toggle('con-carrito', unidades > 0);
  el.barraCantidad.textContent = `${unidades} ${unidades === 1 ? 'producto' : 'productos'}`;
  el.barraTotal.textContent = pesos.format(total);
  el.subtotal.textContent = pesos.format(total);

  el.lineas.innerHTML = lineas.length
    ? lineas
        .map(
          ({ plato, cantidad }) => `
        <li class="linea" data-id="${plato.id}">
          <div class="linea-texto">
            <span class="linea-nombre">${escapar(plato.nombre)}</span>
            <span class="linea-precio">${pesos.format(plato.precio)} c/u</span>
          </div>
          ${htmlContador(plato, cantidad)}
          <span class="linea-total">${pesos.format(plato.precio * cantidad)}</span>
        </li>`,
        )
        .join('')
    : '<li class="linea-vacia">Tu pedido está vacío. Agrega platos desde el menú.</li>';

  if (!lineas.length && !el.hoja.hidden) cerrarHoja();
}

function abrirHoja() {
  el.hoja.hidden = false;
  el.fondoHoja.hidden = false;
  document.body.classList.add('hoja-abierta');
  el.cerrarHoja.focus();
}

function cerrarHoja() {
  el.hoja.hidden = true;
  el.fondoHoja.hidden = true;
  document.body.classList.remove('hoja-abierta');
  el.barraCarrito.focus({ preventScroll: true });
}

let temporizadorAviso;
function avisar(texto) {
  el.aviso.textContent = texto;
  el.aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (el.aviso.hidden = true), 3200);
}

/* ---------- Eventos ---------- */

function activarEventos() {
  carrito.alCambiar(pintarCarrito);

  el.menu.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;
    const tarjeta = boton.closest('.plato');
    const id = Number(tarjeta.dataset.id);
    tarjeta.dataset.foco = boton.dataset.accion === 'restar' && carrito.cantidad(id) === 1 ? 'sumar' : boton.dataset.accion;
    carrito.cambiar(id, boton.dataset.accion === 'sumar' ? 1 : -1);
    refrescarPlato(id);
  });

  el.lineas.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;
    const id = Number(boton.closest('.linea').dataset.id);
    carrito.cambiar(id, boton.dataset.accion === 'sumar' ? 1 : -1);
    refrescarPlato(id);
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
  el.cerrarHoja.addEventListener('click', cerrarHoja);
  el.fondoHoja.addEventListener('click', cerrarHoja);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hoja.hidden) cerrarHoja();
  });

  el.vaciar.addEventListener('click', () => {
    const ids = carrito.lineas(platosPorId).map((l) => l.plato.id);
    carrito.vaciar();
    ids.forEach(refrescarPlato);
  });

  el.continuar.addEventListener('click', () => {
    avisar('Siguiente paso en construcción: datos de entrega y comprobante de pago.');
  });
}

/* ---------- Utilidades ---------- */

function normalizar(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function preferirMovimiento() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

document.title = `${CONFIG.nombre} · Pedidos`;

// Vista "Finalizar pedido": datos del cliente, entrega, pago y comprobante.
// También pinta la vista "Pedido recibido" y sigue el estado del pedido hasta que se entrega.

import { NOMBRES_PAGO } from './config.js';
import { consultarEstado, enviarPedido } from './datos.js';
import { iniciarUbicacionCliente } from './ubicacion-cliente.js';

const CLAVE_CLIENTE = 'delicia-china:cliente';
const CLAVE_SEGUIMIENTO = 'delicia-china:ultimo-pedido';
const CADA_CUANTO = 20000; // ms entre consultas del estado
const VIGENCIA = 24 * 3600 * 1000; // el seguimiento se olvida al día siguiente
const ESTADOS_FINALES = ['entregado', 'rechazado'];

const PASOS = {
  pago_por_revisar: 0,
  en_preparacion: 1,
  en_camino: 2,
  listo_para_recoger: 2,
  entregado: 3,
};

const TEXTO_ESTADO = {
  pago_por_revisar: 'Revisando tu pago',
  en_preparacion: 'En preparación',
  en_camino: 'En camino',
  listo_para_recoger: 'Listo para recoger',
  entregado: 'Entregado',
  rechazado: 'Pago rechazado',
};
const MAX_LADO = 1600; // px del lado más largo del comprobante comprimido
const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS_DIRECTOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function iniciarCheckout({ datos, carrito, platosPorId, pesos, escapar, avisar, irAlMenu, mostrarListo }) {
  const $ = (s) => document.querySelector(s);
  const f = {
    form: $('#form-pedido'),
    resumen: $('#resumen-pedido'),
    total: $('#total-pedido'),
    nombre: $('#f-nombre'),
    telefono: $('#f-telefono'),
    campoDireccion: $('#campo-direccion'),
    direccion: $('#f-direccion'),
    notas: $('#f-notas'),
    notaDomicilio: $('#nota-domicilio-pedido'),
    bloqueUbicacion: $('#bloque-ubicacion'),
    metodos: $('#metodos-pago'),
    datosPago: $('#datos-pago'),
    archivo: $('#f-comprobante'),
    zona: $('#zona-comprobante'),
    vista: $('#vista-comprobante'),
    imagen: $('#imagen-comprobante'),
    nombreArchivo: $('#nombre-comprobante'),
    quitar: $('#quitar-comprobante'),
    errorEnvio: $('#error-envio'),
    enviar: $('#enviar'),
    volver: $('#volver-menu'),
    editar: $('#editar-carrito'),
    listo: $('#contenido-listo'),
    volverListo: $('#volver-desde-listo'),
    seguimiento: $('#seguimiento'),
    textoSeguimiento: $('#texto-seguimiento'),
    ocultarSeguimiento: $('#ocultar-seguimiento'),
  };

  const metodos = (datos.tienda.datosPago ?? []).filter((d) => NOMBRES_PAGO[d.metodo]);
  let comprobante = null; // { blob, ext, tipo, url }
  let ultimo = leerSeguimiento(); // último pedido enviado desde este navegador
  let enviando = false;
  let temporizador = null;
  const ubicacion = iniciarUbicacionCliente();

  rellenarCliente();
  pintarMetodos();
  activarEventos();
  pintarBanner();
  seguirEstado();

  /* ---------- Pintar ---------- */

  function lineasActuales() {
    return carrito.lineas(platosPorId);
  }

  function totalActual() {
    return lineasActuales().reduce((s, l) => s + l.plato.precio * l.cantidad, 0);
  }

  function pintar() {
    const lineas = lineasActuales();
    f.resumen.innerHTML = lineas
      .map((l) => {
        const extra = [...l.opciones, l.nota.trim() ? `“${l.nota.trim()}”` : ''].filter(Boolean).join(' · ');
        return `
          <li>
            <span class="r-cant">${l.cantidad}×</span>
            <span class="r-nombre">${escapar(l.plato.nombre)}${extra ? `<small>${escapar(extra)}</small>` : ''}</span>
            <span class="r-valor">${pesos.format(l.plato.precio * l.cantidad)}</span>
          </li>`;
      })
      .join('');
    const total = totalActual();
    f.total.textContent = pesos.format(total);
    f.enviar.textContent = `Enviar pedido · ${pesos.format(total)}`;
    pintarDatosPago();
    actualizarEntrega();
  }

  function pintarMetodos() {
    if (!metodos.length) {
      f.metodos.innerHTML = '<p class="nota">El restaurante aún no ha configurado los medios de pago.</p>';
      return;
    }
    f.metodos.innerHTML = metodos
      .map(
        (m, i) => `
        <label class="opcion-pago" for="pago-${m.metodo}">
          <input type="radio" name="metodo" id="pago-${m.metodo}" value="${m.metodo}" ${i === 0 ? 'checked' : ''} />
          <span>${NOMBRES_PAGO[m.metodo]}</span>
        </label>`,
      )
      .join('');
  }

  function pintarDatosPago() {
    const elegido = f.form.elements.metodo?.value;
    const m = metodos.find((x) => x.metodo === elegido);
    if (!m) {
      f.datosPago.hidden = true;
      return;
    }
    const filas = [
      m.banco && ['Banco', m.banco],
      m.tipo && ['Tipo de cuenta', m.tipo],
      ['Titular', m.titular],
    ].filter(Boolean);
    f.datosPago.hidden = false;
    f.datosPago.innerHTML = `
      <p class="pago-instruccion">Envía <strong>${pesos.format(totalActual())}</strong> por ${NOMBRES_PAGO[m.metodo]} a:</p>
      <div class="pago-numero">
        <span id="numero-pago" class="numero">${escapar(m.numero)}</span>
        <button type="button" class="boton-copiar" data-copiar="${escapar(m.numero.replace(/\s/g, ''))}">Copiar</button>
      </div>
      <dl class="pago-filas">
        ${filas.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapar(v)}</dd></div>`).join('')}
      </dl>
      <p class="nota">Luego toma un pantallazo del comprobante y súbelo en el paso 4.</p>`;
  }

  function actualizarEntrega() {
    const domicilio = f.form.elements.entrega.value === 'domicilio';
    f.campoDireccion.hidden = !domicilio;
    f.notaDomicilio.hidden = !domicilio;
    f.bloqueUbicacion.hidden = !domicilio;
    if (!domicilio) limpiarError('direccion');
  }

  /* ---------- Comprobante ---------- */

  async function elegirArchivo(archivo) {
    limpiarError('comprobante');
    if (!archivo) return;
    f.zona.classList.add('procesando');
    try {
      const listo = await prepararImagen(archivo);
      if (comprobante?.url) URL.revokeObjectURL(comprobante.url);
      comprobante = listo;
      f.imagen.src = listo.url;
      f.nombreArchivo.textContent = `${archivo.name} · ${tamano(listo.blob.size)}`;
      f.vista.hidden = false;
      f.zona.hidden = true;
    } catch (error) {
      mostrarError('comprobante', error.message);
      f.archivo.value = '';
    } finally {
      f.zona.classList.remove('procesando');
    }
  }

  function quitarComprobante() {
    if (comprobante?.url) URL.revokeObjectURL(comprobante.url);
    comprobante = null;
    f.archivo.value = '';
    f.vista.hidden = true;
    f.zona.hidden = false;
    f.archivo.focus();
  }

  /* ---------- Validación ---------- */

  function telefonoLimpio() {
    let digitos = f.telefono.value.replace(/\D/g, '');
    if (digitos.length === 12 && digitos.startsWith('57')) digitos = digitos.slice(2);
    return digitos;
  }

  function validar() {
    const errores = [];
    const domicilio = f.form.elements.entrega.value === 'domicilio';

    if (f.nombre.value.trim().length < 2) errores.push(['nombre', 'Escribe tu nombre.']);
    if (!/^3\d{9}$/.test(telefonoLimpio()))
      errores.push(['telefono', 'Escribe un celular de 10 dígitos que empiece por 3, por ejemplo 300 123 4567.']);
    if (domicilio && f.direccion.value.trim().length < 5)
      errores.push(['direccion', 'Escribe la dirección y el barrio para el domicilio.']);
    if (!f.form.elements.metodo?.value) errores.push(['metodo', 'Elige cómo vas a pagar.']);
    if (!comprobante) errores.push(['comprobante', 'Sube el pantallazo del comprobante de pago.']);

    ['nombre', 'telefono', 'direccion', 'metodo', 'comprobante'].forEach(limpiarError);
    errores.forEach(([campo, msg]) => mostrarError(campo, msg));
    if (errores.length) {
      const primero = document.querySelector(`[data-campo="${errores[0][0]}"]`);
      primero?.scrollIntoView({ block: 'center' });
      (primero?.querySelector('input, textarea') ?? primero)?.focus({ preventScroll: true });
    }
    return errores.length === 0;
  }

  function mostrarError(campo, mensaje) {
    const contenedor = document.querySelector(`[data-campo="${campo}"]`);
    const error = document.getElementById(`err-${campo}`);
    if (!contenedor || !error) return;
    contenedor.classList.add('con-error');
    error.textContent = mensaje;
    error.hidden = false;
  }

  function limpiarError(campo) {
    document.querySelector(`[data-campo="${campo}"]`)?.classList.remove('con-error');
    const error = document.getElementById(`err-${campo}`);
    if (error) error.hidden = true;
  }

  /* ---------- Envío ---------- */

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    f.errorEnvio.hidden = true;
    if (!lineasActuales().length) {
      irAlMenu();
      return;
    }
    if (!validar()) return;

    enviando = true;
    f.enviar.disabled = true;
    f.enviar.textContent = 'Enviando pedido…';
    f.form.setAttribute('aria-busy', 'true');

    const tipoEntrega = f.form.elements.entrega.value;
    const lineas = lineasActuales();
    const pedido = {
      nombre: f.nombre.value.trim(),
      telefono: telefonoLimpio(),
      tipoEntrega,
      direccion: tipoEntrega === 'domicilio' ? f.direccion.value.trim() : null,
      notas: f.notas.value.trim(),
      metodoPago: f.form.elements.metodo.value,
      comprobante,
      lineas,
      ubicacion: tipoEntrega === 'domicilio' ? ubicacion.valor() : null,
    };

    try {
      const resultado = await enviarPedido(pedido);
      ultimo = {
        id: resultado.id,
        codigo: resultado.codigo,
        total: resultado.total,
        demo: resultado.demo,
        telefono: pedido.telefono,
        tipoEntrega: pedido.tipoEntrega,
        direccion: pedido.direccion,
        metodoPago: pedido.metodoPago,
        creadoEn: Date.now(),
        estado: 'pago_por_revisar',
        motivoRechazo: null,
        oculto: false,
      };
      guardarSeguimiento();
      guardarCliente(pedido);
      seguirEstado();
      pintarListo();
      carrito.vaciar();
      quitarComprobanteSilencioso();
      ubicacion.limpiar();
      f.notas.value = '';
      mostrarListo();
    } catch (error) {
      f.errorEnvio.textContent = error.message || 'No se pudo enviar el pedido. Inténtalo de nuevo.';
      f.errorEnvio.hidden = false;
      f.errorEnvio.scrollIntoView({ block: 'center' });
    } finally {
      enviando = false;
      f.enviar.disabled = false;
      f.form.removeAttribute('aria-busy');
      pintar();
    }
  }

  function quitarComprobanteSilencioso() {
    comprobante = null;
    f.archivo.value = '';
    f.vista.hidden = true;
    f.zona.hidden = false;
  }

  function pintarListo() {
    const p = ultimo;
    if (!p) return;
    const tel = `${p.telefono.slice(0, 3)} ${p.telefono.slice(3, 6)} ${p.telefono.slice(6)}`;
    const wa = (datos.tienda.whatsappTienda ?? '').replace(/\D/g, '');
    const waVisible = wa.length === 12 ? `+57 ${wa.slice(2, 5)} ${wa.slice(5, 8)} ${wa.slice(8)}` : wa;
    const rechazado = p.estado === 'rechazado';
    const paso = PASOS[p.estado] ?? 0;
    const pasos = ['Revisando tu pago', 'En preparación', p.tipoEntrega === 'domicilio' ? 'En camino' : 'Listo para recoger', 'Entregado'];

    const mensaje = {
      pago_por_revisar: `Estamos revisando tu comprobante. Te confirmaremos por WhatsApp al <strong>${tel}</strong>.`,
      en_preparacion: '¡Pago confirmado! Ya estamos preparando tu pedido.',
      en_camino: `Tu pedido va en camino${p.direccion ? ` a ${escapar(p.direccion)}` : ''}.`,
      listo_para_recoger: 'Tu pedido está listo. Puedes pasar a recogerlo al local.',
      entregado: 'Pedido entregado. ¡Buen provecho!',
      rechazado: `No pudimos confirmar tu pago${p.motivoRechazo ? `: ${escapar(p.motivoRechazo)}` : ''}. Escríbenos por WhatsApp y te ayudamos.`,
    }[p.estado];

    document.getElementById('titulo-listo').textContent = rechazado
      ? 'Revisemos tu pago'
      : p.estado === 'entregado'
        ? '¡Pedido entregado!'
        : '¡Pedido recibido!';

    f.listo.innerHTML = `
      ${p.demo ? '<p class="aviso-listo-demo">Modo demo: este pedido solo quedó guardado en este navegador. Ábrelo en el panel (/panel) para verlo llegar.</p>' : ''}
      <p class="codigo">Pedido <strong>#${p.codigo}</strong></p>
      ${
        rechazado
          ? '<p class="estado-rechazado">Pago rechazado</p>'
          : `<ol class="pasos-estado" aria-label="Estado del pedido">
              ${pasos
                .map((t, i) => `<li class="${i < paso ? 'hecho' : i === paso ? 'actual' : ''}"${i === paso ? ' aria-current="step"' : ''}>${t}</li>`)
                .join('')}
            </ol>`
      }
      <p class="mensaje-estado" aria-live="polite">${mensaje}</p>
      ${ESTADOS_FINALES.includes(p.estado) ? '' : '<p class="nota">Esta página se actualiza sola.</p>'}
      <dl class="pago-filas">
        <div><dt>Total pagado</dt><dd>${pesos.format(p.total)}</dd></div>
        <div><dt>Entrega</dt><dd>${p.tipoEntrega === 'domicilio' ? escapar(`Domicilio · ${p.direccion}`) : 'Recoger en el local'}</dd></div>
        <div><dt>Pago</dt><dd>${NOMBRES_PAGO[p.metodoPago]}</dd></div>
      </dl>
      ${p.tipoEntrega === 'domicilio' && !rechazado ? '<p class="nota">El costo del domicilio te lo confirmamos por WhatsApp.</p>' : ''}
      ${
        wa
          ? `<p class="nota">¿Dudas? Escríbenos al WhatsApp <span class="seleccionable">${waVisible}</span>
             · <a href="https://wa.me/${wa}?text=${encodeURIComponent(`Hola, tengo una pregunta sobre mi pedido #${p.codigo}`)}" target="_blank" rel="noopener">abrir WhatsApp</a></p>`
          : ''
      }`;
  }

  /* ---------- Seguimiento del estado ---------- */

  function activo() {
    return ultimo && !ESTADOS_FINALES.includes(ultimo.estado);
  }

  async function actualizarEstado() {
    if (!ultimo?.id) return;
    try {
      const r = await consultarEstado(ultimo.id);
      if (!r) return;
      if (r.estado !== ultimo.estado || r.motivoRechazo !== ultimo.motivoRechazo) {
        const antes = ultimo.estado;
        ultimo = { ...ultimo, estado: r.estado, motivoRechazo: r.motivoRechazo, oculto: false };
        guardarSeguimiento();
        pintarListo();
        pintarBanner();
        if (antes !== r.estado && document.body.dataset.vista !== 'listo') {
          avisar(`Tu pedido #${ultimo.codigo}: ${TEXTO_ESTADO[r.estado].toLowerCase()}`);
        }
      }
    } catch (error) {
      console.warn('No se pudo consultar el estado del pedido.', error);
    }
    if (!activo()) detenerSeguimiento();
  }

  function seguirEstado() {
    detenerSeguimiento();
    if (!activo()) return;
    temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') actualizarEstado();
    }, CADA_CUANTO);
  }

  function detenerSeguimiento() {
    clearInterval(temporizador);
    temporizador = null;
  }

  function pintarBanner() {
    const mostrar = ultimo && !ultimo.oculto && ultimo.estado !== 'entregado';
    f.seguimiento.hidden = !mostrar;
    if (!mostrar) return;
    f.textoSeguimiento.textContent = `Tu pedido #${ultimo.codigo}: ${TEXTO_ESTADO[ultimo.estado] ?? ''}`;
    f.seguimiento.dataset.estado = ultimo.estado;
  }

  function leerSeguimiento() {
    try {
      const p = JSON.parse(localStorage.getItem(CLAVE_SEGUIMIENTO) ?? 'null');
      if (!p?.id || Date.now() - p.creadoEn > VIGENCIA) return null;
      return p;
    } catch {
      return null;
    }
  }

  function guardarSeguimiento() {
    try {
      localStorage.setItem(CLAVE_SEGUIMIENTO, JSON.stringify(ultimo));
    } catch {
      /* sin almacenamiento: el seguimiento dura mientras la página esté abierta */
    }
  }

  /* ---------- Datos del cliente recordados ---------- */

  function rellenarCliente() {
    try {
      const c = JSON.parse(localStorage.getItem(CLAVE_CLIENTE) ?? 'null');
      if (!c) return;
      f.nombre.value = c.nombre ?? '';
      f.telefono.value = c.telefono ?? '';
      f.direccion.value = c.direccion ?? '';
      if (c.tipoEntrega === 'recoger' || c.tipoEntrega === 'domicilio') f.form.elements.entrega.value = c.tipoEntrega;
    } catch {
      /* sin almacenamiento */
    }
  }

  function guardarCliente(p) {
    try {
      localStorage.setItem(
        CLAVE_CLIENTE,
        JSON.stringify({ nombre: p.nombre, telefono: p.telefono, direccion: p.direccion ?? f.direccion.value.trim(), tipoEntrega: p.tipoEntrega }),
      );
    } catch {
      /* sin almacenamiento */
    }
  }

  /* ---------- Eventos ---------- */

  function activarEventos() {
    f.form.addEventListener('submit', enviar);
    f.form.addEventListener('change', (e) => {
      if (e.target.name === 'entrega') actualizarEntrega();
      if (e.target.name === 'metodo') {
        limpiarError('metodo');
        pintarDatosPago();
      }
    });
    f.form.addEventListener('input', (e) => {
      const campo = e.target.closest('[data-campo]')?.dataset.campo;
      if (campo && campo !== 'comprobante') limpiarError(campo);
    });
    f.archivo.addEventListener('change', () => elegirArchivo(f.archivo.files[0]));
    f.quitar.addEventListener('click', quitarComprobante);

    // Arrastrar y soltar en computador
    f.zona.addEventListener('dragover', (e) => {
      e.preventDefault();
      f.zona.classList.add('arrastrando');
    });
    f.zona.addEventListener('dragleave', () => f.zona.classList.remove('arrastrando'));
    f.zona.addEventListener('drop', (e) => {
      e.preventDefault();
      f.zona.classList.remove('arrastrando');
      elegirArchivo(e.dataTransfer.files[0]);
    });

    f.datosPago.addEventListener('click', async (e) => {
      const boton = e.target.closest('[data-copiar]');
      if (!boton) return;
      try {
        await navigator.clipboard.writeText(boton.dataset.copiar);
        boton.textContent = 'Copiado';
        setTimeout(() => (boton.textContent = 'Copiar'), 2000);
      } catch {
        const numero = document.getElementById('numero-pago');
        const rango = document.createRange();
        rango.selectNodeContents(numero);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(rango);
        avisar('Número seleccionado. Mantén presionado para copiarlo.');
      }
    });

    f.volver.addEventListener('click', irAlMenu);
    f.editar.addEventListener('click', () => {
      irAlMenu();
      document.querySelector('#barra-carrito')?.click();
    });
    f.volverListo.addEventListener('click', irAlMenu);
    f.ocultarSeguimiento.addEventListener('click', () => {
      if (!ultimo) return;
      ultimo.oculto = true;
      guardarSeguimiento();
      pintarBanner();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && activo()) actualizarEstado();
    });
  }

  return {
    pintar,
    hayConfirmacion: () => ultimo !== null,
    // Al abrir la vista "Pedido recibido": pintar y consultar de inmediato.
    alMostrarListo() {
      pintarListo();
      actualizarEstado();
      seguirEstado();
    },
  };
}

/* ---------- Imagen del comprobante ---------- */

// Reduce el pantallazo a un JPG liviano. Si el navegador no puede leerlo,
// se sube tal cual cuando es JPG, PNG o WebP y pesa menos de 5 MB.
async function prepararImagen(archivo) {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('El comprobante debe ser una imagen (pantallazo o foto).');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(archivo);
  } catch {
    const ext = TIPOS_DIRECTOS[archivo.type];
    if (ext && archivo.size <= MAX_BYTES) {
      return { blob: archivo, ext, tipo: archivo.type, url: URL.createObjectURL(archivo) };
    }
    throw new Error('No pudimos leer esa imagen. Envía un pantallazo en JPG o PNG.');
  }

  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#ffffff'; // fondo para PNG con transparencia
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close?.();

  const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82));
  if (!blob) throw new Error('No pudimos procesar la imagen. Intenta con otro pantallazo.');

  // Si el original ya era liviano y aceptado, se conserva el más pequeño.
  const ext = TIPOS_DIRECTOS[archivo.type];
  if (ext && archivo.size <= blob.size && archivo.size <= MAX_BYTES) {
    return { blob: archivo, ext, tipo: archivo.type, url: URL.createObjectURL(archivo) };
  }
  if (blob.size > MAX_BYTES) throw new Error('La imagen es muy pesada. Envía un pantallazo en lugar de una foto.');
  return { blob, ext: 'jpg', tipo: 'image/jpeg', url: URL.createObjectURL(blob) };
}

function tamano(bytes) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

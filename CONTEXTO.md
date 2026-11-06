# Piloto: app de pedidos para Delicia China (restaurante de comida china)

Fecha del documento: 4 de noviembre de 2026
Estado: piloto completo con Supabase; geolocalización fase 1 lista

## 1. Contexto

- Idea: una web de pedidos para el restaurante de comida china de un amigo, como piloto para convencerlo antes de invertir en dominio o hosting.
- Situación actual del restaurante: los pedidos entran por WhatsApp y llamadas, de forma manual.
- Quién construye: el estudiante (primer semestre) con apoyo de Claude. Claude escribe la mayor parte del código; el estudiante prueba, decide y presenta.
- Restricción clave: costo cero hasta tener la confirmación del dueño (sin dominio propio, hosting de pago ni API de WhatsApp de pago).

## 2. Objetivo

Entregar un **piloto funcional en un enlace público gratuito** que el dueño pueda probar desde su tablet, con su menú real cargado, y que demuestre:

1. **Menos desorden:** pedidos ordenados en un panel en lugar de perdidos en chats.
2. **Control de pagos:** ningún pedido se prepara sin comprobante revisado y aprobado.
3. **Mejor experiencia del cliente:** pedir fácil desde el celular con un menú claro.

Argumento de venta adicional: ahorro frente a las comisiones de las apps de domicilio (se puede mostrar con el resumen del día).

## 3. Cómo convencer al dueño

- Mostrarle **su menú real** cargado, con sus platos y precios.
- Que pruebe el panel **en su propia tablet**, haciendo un pedido de prueba de punta a punta.
- Proponerle una **prueba de una semana** con pedidos reales, sin compromiso.
- Presentar el ahorro en comisiones frente a las apps de domicilio.

## 4. Flujo del piloto

1. El cliente abre la web desde el celular y navega el menú por categorías (con búsqueda, porque son más de 60 platos).
2. Agrega platos al carrito, con notas u opciones por plato (sin cebolla, porción, salsa aparte).
3. Elige **domicilio** o **recoger en el local** y completa sus datos (y dirección si es domicilio).
4. Ve las instrucciones de pago (Nequi, Daviplata o transferencia bancaria) y **sube el pantallazo del comprobante**.
5. El pedido llega al panel de la tienda con estado *Pago por revisar*.
6. El empleado revisa el comprobante y **aprueba o rechaza**.
7. Al aprobar, el panel abre **WhatsApp con el mensaje de confirmación ya escrito**, y el empleado solo pulsa enviar.
8. El pedido avanza por estados hasta quedar entregado.

## 5. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Entregable | Piloto funcional, publicado en hosting gratuito |
| Entrega | Domicilio y recoger en el local |
| Costo de domicilio | Se acuerda por WhatsApp; el total de la web no incluye envío |
| Pagos aceptados en la web | Solo pago adelantado con comprobante (Nequi, Daviplata, transferencia). Efectivo y datáfono quedan fuera del piloto |
| Confirmación por WhatsApp | Botón desde el panel que abre WhatsApp con el mensaje listo (gratis, sin API oficial) |
| Quién opera el panel | Empleado en el local, en tablet |
| Tamaño del menú | Más de 60 platos, con categorías y búsqueda |
| Facturación | No incluida |
| Datos del menú | Genéricos de ejemplo (nombres y precios de relleno); se cambian por los reales tras la aprobación del dueño |
| Identidad visual | Nombre y logo de Delicia China, en negro y dorado |

## 6. Alcance del piloto

**Incluye**
- Menú por categorías con búsqueda, carrito y pedido.
- Opciones o notas por plato.
- Datos del cliente y dirección para domicilio.
- Subida de comprobante de pago.
- Panel para tablet con revisión de comprobantes.
- Estados del pedido: *Pago por revisar*, *Aprobado / En preparación*, *En camino / Listo para recoger*, *Entregado / Rechazado*.
- Alerta sonora en el panel cuando entra un pedido nuevo.
- Horario de atención: el local abre o cierra la recepción de pedidos desde el panel.
- Logo y colores del restaurante.

**Fuera del piloto (para una segunda etapa si el dueño acepta)**
- Pago en efectivo contra entrega o datáfono desde la web.
- Cálculo automático de costo de envío o zonas.
- Mensajes automáticos con la API oficial de WhatsApp Business.
- Lectura automática del comprobante (OCR).
- Cuentas de cliente e historial de pedidos.
- Reportes y estadísticas, resumen del día y fotos de todos los platos.
- Dominio propio y hosting de pago.

## 7. Herramientas

- **Supabase** (plan gratuito): base de datos, login del panel y almacenamiento de comprobantes.
- **Hosting gratuito para la web** (Vercel, Cloudflare Pages o Netlify), con enlace provisional.
- **Web en HTML, CSS y JavaScript sin compilación**: no requiere instalar Node ni paquetes; se sube la carpeta tal cual. Supabase se carga desde CDN solo cuando está configurado.
- **WhatsApp** por enlace `wa.me` con mensaje prellenado.
- Diseño pensado primero para celular (cliente) y para tablet horizontal (panel).
- Nota: los límites de los planes gratuitos cambian; verificarlos al montar el proyecto, por ejemplo la pausa de proyectos inactivos en Supabase.

## 8. Material disponible

- Nombre: **Delicia China**, con el lema "El sabor tradicional de China en Piedecuesta".
- Marca: el logo es un cuenco dorado con palillos sobre fondo negro; paleta base negro y dorado. Tipografía decorativa de aire oriental para el nombre.
- **Menú y precios genéricos por ahora:** el piloto usa un menú de ejemplo (`menu-generico.json`, 65 platos en 13 categorías). Los platos y precios reales se cargan solo si el dueño acepta.
- Falta: fotos de los platos (el piloto arranca sin fotos o con imágenes de relleno).

## 9. Plazo y ritmo

- Meta: piloto listo en **3 a 4 semanas**.
- Dedicación: **1 a 2 horas diarias**, es decir, unas 25 a 55 horas en total.
- Riesgo principal: ampliar el alcance en el camino. Cualquier extra nuevo se anota para la segunda etapa.

Propuesta de avance por semanas (a ajustar):

| Semana | Entregable |
|---|---|
| 1 | Diseño de pantallas y datos, proyecto base, menú cargado y mostrado por categorías |
| 2 | Carrito, formulario de pedido, subida de comprobante |
| 3 | Panel de la tienda: estados, aprobación, botón de WhatsApp, alerta sonora, horario |
| 4 | Pruebas en tablet y celular, ajustes, publicación y guion de presentación al dueño |

## 10. Pendientes por definir

- Archivo del logo en buena resolución (idealmente con fondo transparente) para usarlo en la web.
- Datos para las instrucciones de pago (en el piloto pueden ser números de ejemplo).
- Texto del mensaje de confirmación por WhatsApp.
- Reglas del horario de atención.
- Fecha tentativa para presentarle el piloto al dueño.
- Criterio de éxito de la semana de prueba (por ejemplo, cantidad de pedidos o comparación con lo que hoy paga en comisiones).

## 11. Avance

**Semana 1 (terminada, 4 de noviembre de 2026)**
- Proyecto base en `delicia-china/` (ver README.md).
- Menú de ejemplo por categorías, búsqueda sin tildes, contador por plato y carrito que se conserva al recargar.
- Estado de la tienda (abierto/cerrado) y aviso de "precios de ejemplo".
- Logo recortado del original; estilo negro y dorado.
- Esquema de Supabase probado en PostgreSQL: tablas, seguridad por filas, función `crear_pedido` que calcula el total en el servidor, bucket privado de comprobantes y tiempo real para el panel.
- Vista previa publicada como artifact para revisarla desde el celular.

**Publicación (4 de noviembre de 2026)**
- Código en GitHub: `acruxzx/delicia-china-pedidos`, ramas `main` (estable) y `desarrollo` (avances).
- Publicado en Cloudflare (Worker con archivos estáticos): https://delicia-china-pedidos.juanfelipeladino8.workers.dev/ — se actualiza solo con cada cambio en `main`.

**Semana 2 (en `desarrollo`)**
- Opciones y nota por plato en el carrito.
- Vista Finalizar pedido: nombre, celular, domicilio o recoger, dirección, indicaciones, medio de pago con datos para copiar, subida del comprobante comprimido.
- Pantalla Pedido recibido con número de pedido y pasos del estado.
- Envío real a Supabase ya programado (Storage + función `crear_pedido`); se activa al llenar `js/config.js`.
- Pendiente: crear el proyecto de Supabase y probar un pedido real de punta a punta.

**Ajuste de publicación**
- Cloudflare ejecuta `wrangler preview`; se agregó `wrangler.jsonc` (con bloque `previews`) y la web pasó a `public/`. Solo esa carpeta se publica.
- Deploy command de producción: `npx wrangler deploy`; ramas que no son producción: `npx wrangler preview`.

**Semana 3: panel del restaurante (`/panel`)**
- Pestañas Por revisar, En curso y Finalizados; marca de "Nuevo"; alerta sonora que se repite mientras haya pedidos sin abrir.
- Detalle con comprobante ampliable; aprobar, rechazar con motivo (motivos rápidos), en camino o listo para recoger, entregado.
- Mensaje de WhatsApp editable por estado, con costo opcional del domicilio; abre wa.me con el cliente.
- Interruptor para abrir o cerrar la recepción, que se refleja en el menú del cliente.
- Modo demo: la web y el panel comparten los pedidos en el mismo navegador; el panel trae tres pedidos de ejemplo y un botón "Simular pedido". Contraseña libre.
- Con Supabase: ingreso con usuario del personal, pedidos en tiempo real y comprobantes con enlace firmado de una hora.

**Semana 4 (Supabase y mejoras)**
- Supabase conectado (proyecto `oycremitolvivjyoltfn`, clave publishable en config.js). Probado celular → tablet.
- Seguimiento del pedido en la página del cliente (función `estado_pedido`, 03-seguimiento.sql).
- Buscador de pedidos en el panel.
- Desde el 4 de noviembre todo se sube directo a `main`.

**Facturación: Alegra**
- El restaurante factura electrónicamente con Alegra (uso interno de los trabajadores). La app debe presentarse como complemento, no como otro software a pagar.
- Alegra tiene API (correo + token, 150 consultas/min, sin ambiente de pruebas, requiere plan con integraciones). Integración posible a futuro: leer menú y precios, crear facturas al aprobar pedidos. No incluida en el piloto.

**Geolocalización (6 de noviembre de 2026)**
- Fase 1 hecha: ubicación opcional del cliente (GPS o tocando el mapa, pin movible), guardada con el pedido y borrada a los 7 días (04-ubicacion.sql). Panel con mapa, distancia y botones de ruta (Google Maps, Waze).
- Local: Cra. 15, Piedecuesta (6.99184, -73.04639). Repartidores propios (cantidad por confirmar).
- Fase 2 pendiente: panel de repartidores (/repartidor) con pedidos asignados.
- Fase 3 pendiente: seguimiento en vivo del repartidor (limitado: el navegador solo envía la ubicación con la página abierta).

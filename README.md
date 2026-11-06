# Delicia China · Piloto de pedidos

Web de pedidos para Delicia China (Piedecuesta). Es un piloto para mostrarle al dueño:
el cliente pide desde el celular, sube el comprobante de pago y el local lo aprueba desde una tablet.

> **Platos y precios de ejemplo.** El menú de `data/menu.json` es genérico. Se reemplaza por el real si el dueño acepta.

## Estado: piloto completo con Supabase

- Menú por categorías (65 platos de ejemplo en 13 categorías) con barra de categorías que sigue el desplazamiento.
- Búsqueda que ignora tildes y mayúsculas ("wantan" encuentra "Wantán").
- Botón **Agregar** que se convierte en contador, y carrito que se conserva si se recarga la página.
- Resumen del pedido con subtotal.
- **Semana 2:** opciones y nota por plato (aplican a todas las unidades de ese plato), vista **Finalizar pedido** con datos del cliente, domicilio o recoger, medio de pago con número para copiar, subida del pantallazo del comprobante (se reduce a un JPG liviano) y pantalla **Pedido recibido**. La web recuerda nombre, celular y dirección del cliente para la próxima vez.
- **Ubicación del domicilio (opcional):** botón **Usar mi ubicación actual** en el formulario. Muestra un mapa con un pin que el cliente puede mover; si no da permiso, puede marcar el lugar tocando el mapa. La dirección escrita sigue siendo obligatoria. La ubicación se borra sola a los 7 días.
- **Seguimiento del pedido:** la página "Pedido recibido" consulta el estado cada 20 segundos y avanza sola (revisando pago → en preparación → en camino o listo → entregado, o rechazado con el motivo). Si el cliente vuelve al menú, ve un aviso con el estado de su pedido durante 24 horas.
- **Semana 3: panel del restaurante en `/panel`**, pensado para tablet horizontal (también funciona en celular):
  - Lista de pedidos en tres pestañas: **Por revisar**, **En curso** y **Finalizados**. Los que nadie ha abierto se marcan como **Nuevo**.
  - **Alerta sonora** al llegar un pedido, que se repite cada 30 segundos mientras haya pedidos nuevos sin abrir. Se activa con el primer toque en la pantalla.
  - Detalle con cliente, platos (con opciones y notas), total y **comprobante** (se amplía al tocarlo).
  - **Aprobar** o **rechazar con motivo**, y luego **En camino** o **Listo para recoger**, y **Entregado**.
  - **Mensaje de WhatsApp** listo para cada estado, editable, con campo opcional para el costo del domicilio. El botón abre el chat con el cliente; el empleado solo pulsa enviar.
  - Interruptor para **abrir o cerrar la recepción** de pedidos.
  - **Buscador** por número de pedido, nombre o celular.
  - **Despacho a domicilio:** con repartidores registrados, el pedido pasa de «En preparación» a **Listo para despachar**. Se puede dejar para «el primero que lo tome» o **asignarlo** a un repartidor. El **costo del domicilio** se guarda y lo ve el repartidor.
  - **Equipo:** botón para dar rol a cada usuario (Personal, Repartidor o Sin acceso).
  - **Ubicación de entrega:** mapa con el local y el cliente, distancia en línea recta y botones **Ruta en Google Maps** y **Ruta en Waze**. Si el cliente no compartió ubicación, botón para buscar la dirección en Google Maps.
  - La pantalla se mantiene encendida mientras el panel está abierto (si el navegador lo permite).

- **App del repartidor en `/repartidor`** (celular):
  - **En camino** y **Para salir**, con dirección, cliente, distancia, notas, productos y cuánto cobrar de domicilio.
  - **Salir con el pedido** (si dos lo intentan a la vez, solo uno lo consigue), **Entregado** con confirmación y **No puedo llevarlo** para devolverlo.
  - Botones de **Google Maps**, **Waze**, **Llamar** y **WhatsApp** al cliente; **Mapa** opcional con todos los pedidos.
  - Se actualiza cada 15 segundos, vibra con pedidos nuevos y mantiene la pantalla encendida.
- El cliente ve «Listo, sale en un momento» y luego «en camino con Carlos».

### Roles

- **Personal:** usa `/panel`. Los usuarios que ya existían al ejecutar `05-repartidores.sql` quedan como personal.
- **Repartidor:** usa `/repartidor`. Solo ve los pedidos que puede llevar, mediante funciones de la base de datos.
- **Agregar a alguien:** Supabase → Authentication → Users → Add user (marcar «Auto Confirm User»). Luego, en el panel, **Equipo** → asignarle el rol.

### Modo demo

Sin Supabase, la web y el panel guardan los datos en el navegador. Para probar el ciclo completo, abre el menú y `/panel` **en el mismo navegador** (por ejemplo, dos pestañas): los pedidos que hagas en el menú llegan al panel. En el panel se entra con cualquier contraseña, empieza con tres pedidos de **ejemplo** y tiene un botón **Simular pedido** para mostrar la alerta. Entre dispositivos distintos (celular → tablet) solo funciona con Supabase.

## Cómo verlo en tu computador

La web no necesita instalar nada, pero debe abrirse con un servidor local (abrir `index.html` con doble clic no carga el menú).

**Opción A, VS Code:** instala la extensión *Live Server*, abre `public/index.html` y pulsa **Go Live**.

**Opción B, Python:** en una terminal dentro de la carpeta `public`:

```bash
python -m http.server 8000
```

y abre <http://localhost:8000> (la terminal debe estar dentro de la carpeta `public`) en el navegador. Para verlo como celular, usa las herramientas de desarrollo del navegador (F12) y el modo de dispositivo.

## Estructura

```
delicia-china-pedidos/
├── wrangler.jsonc            Configuración de Cloudflare: publica solo public/
├── public/                   Todo lo que ve el cliente
│   ├── index.html            Pantalla del cliente
│   ├── css/estilos.css       Estilos (negro y dorado, como el logo)
│   ├── css/panel.css         Estilos del panel
│   ├── css/repartidor.css    Estilos de la app del repartidor
│   ├── js/
│   │   ├── config.js         Nombre, datos de Supabase y valores del modo demo
│   │   ├── datos.js          Lee el menú y envía pedidos (Supabase o modo demo)
│   │   ├── carrito.js        Carrito guardado en el navegador (cantidad, opciones y nota)
│   │   ├── checkout.js       Finalizar pedido: datos, entrega, pago, comprobante y confirmación
│   │   ├── app.js            Menú, búsqueda, categorías, carrito y vistas (#pedido, #listo)
│   │   ├── demo.js           Almacén del modo demo, compartido por la web y el panel
│   │   ├── mapa.js           Mapas (Leaflet + OpenStreetMap, cargados solo al usarlos), distancias y rutas
│   │   ├── ubicacion-cliente.js  Botón "Usar mi ubicación" y pin en el formulario
│   │   ├── panel-datos.js    Datos del panel: sesión, rol, equipo, pedidos, estados, comprobantes, tienda
│   │   ├── panel.js          Pantalla del panel
│   │   ├── repartidor-datos.js   Datos de la app del repartidor
│   │   └── repartidor.js         App del repartidor
│   ├── panel/index.html      Panel del restaurante (/panel)
│   ├── repartidor/index.html App del repartidor (/repartidor)
│   ├── data/menu.json        Menú genérico de ejemplo
│   └── img/                  Logo, ícono y favicon
├── supabase/
│   ├── 01-esquema.sql        Tablas, seguridad, función crear_pedido y bucket de comprobantes
│   ├── 02-datos-ejemplo.sql  Configuración y menú de ejemplo
│   ├── 03-seguimiento.sql    Función estado_pedido (solo si el esquema se instaló antes de ese cambio)
│   ├── 04-ubicacion.sql      Ubicación del domicilio (solo si el esquema se instaló antes de ese cambio)
│   └── 05-repartidores.sql   Roles (personal/repartidor), despacho y funciones del repartidor (siempre)
├── README.md
└── CONTEXTO.md               Decisiones y avance del piloto
```

## Modo demo y modo Supabase

Mientras `supabaseUrl` y `supabaseAnonKey` estén vacíos en `public/js/config.js`, la web funciona sola con `data/menu.json`.
Al llenarlos, lee el menú y el estado de la tienda desde Supabase. Si Supabase falla, vuelve al menú de ejemplo.

## Base de datos (resumen)

| Tabla | Para qué |
|---|---|
| `categorias`, `platos` | El menú. `disponible = false` sirve para "agotado hoy". |
| `configuracion` | Una sola fila: abrir/cerrar pedidos, horario, WhatsApp, datos de pago, opciones por plato. |
| `pedidos` | Datos del cliente, entrega, método de pago, comprobante, total y estado. |
| `pedido_items` | Platos de cada pedido, con copia del nombre y precio del momento. |

Reglas de seguridad:

- El cliente **solo lee el menú** y **crea pedidos con la función `crear_pedido`**. No puede ver pedidos de otros.
- El cliente consulta el estado de **su** pedido con la función `estado_pedido`, usando el id secreto (uuid) que recibió al crearlo.
- `crear_pedido` calcula el total con los precios de la base de datos, así nadie cambia precios desde el navegador.
- Los comprobantes van a un bucket privado: el cliente solo sube, el personal puede verlos.
- El personal (usuario con sesión iniciada) ve y actualiza pedidos, menú y configuración.

Estados del pedido: `pago_por_revisar` → `en_preparacion` → `en_camino` o `listo_para_recoger` → `entregado`, o `rechazado`.

## Próximos pasos

- **Pendiente:** crear el proyecto gratuito en Supabase, ejecutar los dos scripts SQL, poner la URL y la clave pública en `public/js/config.js` y crear el usuario del personal (Supabase → Authentication → Add user) para entrar al panel.
- **Semana 4:** pruebas en celular y tablet, publicación en hosting gratuito y guion para presentarle el piloto al dueño.

## Ramas y publicación

- `main`: versión estable, publicada en Cloudflare (enlace principal).
- `desarrollo`: avances de cada semana. Cuando se aprueban, se pasan a `main`.
- Cloudflare publica solo la carpeta `public/` (ver `wrangler.jsonc`); README, CONTEXTO y los scripts SQL no quedan en la web.

## Mapas

- Se usa Leaflet con los mapas públicos de OpenStreetMap: gratis y suficiente para el piloto, pero sin garantía de disponibilidad. Si el volumen crece, cambiar el proveedor en `public/js/mapa.js` (una línea).
- La ubicación del local está en `public/js/config.js` (`ubicacionLocal`).
- Privacidad: la ubicación es opcional, se pide con un texto claro de para qué se usa y la base de datos la borra a los 7 días.

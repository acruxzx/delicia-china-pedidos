# Delicia China · Piloto de pedidos

Web de pedidos para Delicia China (Piedecuesta). Es un piloto para mostrarle al dueño:
el cliente pide desde el celular, sube el comprobante de pago y el local lo aprueba desde una tablet.

> **Platos y precios de ejemplo.** El menú de `data/menu.json` es genérico. Se reemplaza por el real si el dueño acepta.

## Estado: semana 2 en la rama `desarrollo`

- Menú por categorías (65 platos de ejemplo en 13 categorías) con barra de categorías que sigue el desplazamiento.
- Búsqueda que ignora tildes y mayúsculas ("wantan" encuentra "Wantán").
- Botón **Agregar** que se convierte en contador, y carrito que se conserva si se recarga la página.
- Resumen del pedido con subtotal.
- **Semana 2:** opciones y nota por plato (aplican a todas las unidades de ese plato), vista **Finalizar pedido** con datos del cliente, domicilio o recoger, medio de pago con número para copiar, subida del pantallazo del comprobante (se reduce a un JPG liviano) y pantalla **Pedido recibido**. La web recuerda nombre, celular y dirección del cliente para la próxima vez.
- En modo demo el pedido no se guarda en ningún lado; la pantalla final lo dice.
- Estado de la tienda: "Recibiendo pedidos" o "Cerrado por ahora" (si está cerrado, no se puede agregar).
- Base de datos diseñada y probada para Supabase (`supabase/`).

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
│   ├── js/
│   │   ├── config.js         Nombre, datos de Supabase y valores del modo demo
│   │   ├── datos.js          Lee el menú y envía pedidos (Supabase o modo demo)
│   │   ├── carrito.js        Carrito guardado en el navegador (cantidad, opciones y nota)
│   │   ├── checkout.js       Finalizar pedido: datos, entrega, pago, comprobante y confirmación
│   │   └── app.js            Menú, búsqueda, categorías, carrito y vistas (#pedido, #listo)
│   ├── data/menu.json        Menú genérico de ejemplo
│   └── img/                  Logo, ícono y favicon
├── supabase/
│   ├── 01-esquema.sql        Tablas, seguridad, función crear_pedido y bucket de comprobantes
│   └── 02-datos-ejemplo.sql  Configuración y menú de ejemplo
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
- `crear_pedido` calcula el total con los precios de la base de datos, así nadie cambia precios desde el navegador.
- Los comprobantes van a un bucket privado: el cliente solo sube, el personal puede verlos.
- El personal (usuario con sesión iniciada) ve y actualiza pedidos, menú y configuración.

Estados del pedido: `pago_por_revisar` → `en_preparacion` → `en_camino` o `listo_para_recoger` → `entregado`, o `rechazado`.

## Próximos pasos

- **Pendiente de la semana 2:** crear el proyecto gratuito en Supabase, ejecutar los dos scripts SQL y poner la URL y la clave pública en `js/config.js`.
- **Semana 3:** panel para tablet: lista de pedidos en tiempo real con alerta sonora, ver comprobante, aprobar o rechazar, botón de WhatsApp, abrir y cerrar pedidos.
- **Semana 4:** pruebas en celular y tablet, publicación en hosting gratuito y guion para presentarle el piloto al dueño.

## Ramas y publicación

- `main`: versión estable, publicada en Cloudflare (enlace principal).
- `desarrollo`: avances de cada semana. Cuando se aprueban, se pasan a `main`.
- Cloudflare publica solo la carpeta `public/` (ver `wrangler.jsonc`); README, CONTEXTO y los scripts SQL no quedan en la web.

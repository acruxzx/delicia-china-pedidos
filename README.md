# Delicia China · Piloto de pedidos

Web de pedidos para Delicia China (Piedecuesta). Es un piloto para mostrarle al dueño:
el cliente pide desde el celular, sube el comprobante de pago y el local lo aprueba desde una tablet.

> **Platos y precios de ejemplo.** El menú de `data/menu.json` es genérico. Se reemplaza por el real si el dueño acepta.

## Estado: semana 1 lista

- Menú por categorías (65 platos de ejemplo en 13 categorías) con barra de categorías que sigue el desplazamiento.
- Búsqueda que ignora tildes y mayúsculas ("wantan" encuentra "Wantán").
- Botón **Agregar** que se convierte en contador, y carrito que se conserva si se recarga la página.
- Resumen del pedido con subtotal. El botón **Continuar** todavía no lleva a ninguna parte (semana 2).
- Estado de la tienda: "Recibiendo pedidos" o "Cerrado por ahora" (si está cerrado, no se puede agregar).
- Base de datos diseñada y probada para Supabase (`supabase/`).

## Cómo verlo en tu computador

La web no necesita instalar nada, pero debe abrirse con un servidor local (abrir `index.html` con doble clic no carga el menú).

**Opción A, VS Code:** instala la extensión *Live Server*, abre la carpeta y pulsa **Go Live**.

**Opción B, Python:** en una terminal dentro de la carpeta:

```bash
python -m http.server 8000
```

y abre <http://localhost:8000> en el navegador. Para verlo como celular, usa las herramientas de desarrollo del navegador (F12) y el modo de dispositivo.

## Estructura

```
delicia-china/
├── index.html            Pantalla del cliente
├── css/estilos.css       Estilos (negro y dorado, como el logo)
├── js/
│   ├── config.js         Nombre, datos de Supabase y valores del modo demo
│   ├── datos.js          Lee el menú: de Supabase si está configurado, si no de data/menu.json
│   ├── carrito.js        Carrito guardado en el navegador
│   └── app.js            Pinta el menú, búsqueda, categorías y carrito
├── data/menu.json        Menú genérico de ejemplo
├── img/                  Logo, ícono y favicon recortados del logo original
└── supabase/
    ├── 01-esquema.sql        Tablas, seguridad, función crear_pedido y bucket de comprobantes
    └── 02-datos-ejemplo.sql  Configuración y menú de ejemplo
```

## Modo demo y modo Supabase

Mientras `supabaseUrl` y `supabaseAnonKey` estén vacíos en `js/config.js`, la web funciona sola con `data/menu.json`.
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

- **Semana 2:** notas y opciones por plato, formulario de entrega (domicilio o recoger), instrucciones de pago, subida del comprobante, crear el proyecto gratuito en Supabase.
- **Semana 3:** panel para tablet: lista de pedidos en tiempo real con alerta sonora, ver comprobante, aprobar o rechazar, botón de WhatsApp, abrir y cerrar pedidos.
- **Semana 4:** pruebas en celular y tablet, publicación en hosting gratuito y guion para presentarle el piloto al dueño.

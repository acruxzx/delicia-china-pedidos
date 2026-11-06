// Configuración del piloto Delicia China.
// Mientras supabaseUrl y supabaseAnonKey estén vacíos, la web funciona en
// "modo demo": lee el menú de data/menu.json y los pedidos no se guardan.

export const CONFIG = {
  nombre: 'Delicia China',
  lema: 'El sabor tradicional de China en Piedecuesta',
  ciudad: 'Piedecuesta, Santander',

  // Ubicación del local (Cra. 15, Piedecuesta). Centra los mapas y sirve para calcular distancias.
  ubicacionLocal: { lat: 6.99184, lng: -73.04639 },

  // A partir de esta distancia (km en línea recta) se le pregunta al cliente si su ubicación es correcta.
  distanciaMaximaKm: 15,

  // Supabase. La clave "publishable" es pública por diseño: la seguridad la dan
  // las reglas de la base de datos (RLS). Nunca poner aquí la clave "secret".
  // Para volver al modo demo, deja ambos valores vacíos.
  supabaseUrl: 'https://oycremitolvivjyoltfn.supabase.co',
  supabaseAnonKey: 'sb_publishable_ECIoOhOUFx08viqrA_pY-w_OjVAUIQW',

  // Valores de ejemplo para el modo demo. Con Supabase, salen de la tabla "configuracion".
  demo: {
    recibiendoPedidos: true,
    horarioTexto: 'Todos los días, 11:00 a. m. a 9:00 p. m.',
    whatsappTienda: '573000000000',
    datosPago: [
      { metodo: 'nequi', titular: 'Delicia China (ejemplo)', numero: '300 000 0000' },
      { metodo: 'daviplata', titular: 'Delicia China (ejemplo)', numero: '300 000 0000' },
      {
        metodo: 'transferencia',
        titular: 'Delicia China (ejemplo)',
        banco: 'Banco de ejemplo',
        tipo: 'Ahorros',
        numero: '000-000000-00',
      },
    ],
  },
};

export const NOMBRES_PAGO = {
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  transferencia: 'Transferencia bancaria',
};

// Configuración del piloto Delicia China.
// Mientras supabaseUrl y supabaseAnonKey estén vacíos, la web funciona en
// "modo demo": lee el menú de data/menu.json y los pedidos no se guardan.

export const CONFIG = {
  nombre: 'Delicia China',
  lema: 'El sabor tradicional de China en Piedecuesta',

  // Supabase: se llenan al crear el proyecto gratuito.
  // La "anon key" es pública por diseño; la seguridad la dan las reglas (RLS).
  supabaseUrl: '',
  supabaseAnonKey: '',

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

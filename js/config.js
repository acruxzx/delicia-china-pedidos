// Configuración del piloto Delicia China.
// Mientras supabaseUrl y supabaseAnonKey estén vacíos, la web funciona en
// "modo demo": lee el menú de data/menu.json y no guarda nada en servidores.

export const CONFIG = {
  nombre: 'Delicia China',
  lema: 'El sabor tradicional de China en Piedecuesta',

  // Supabase: se llenan en la semana 2, al crear el proyecto gratuito.
  // La "anon key" es pública por diseño; la seguridad la dan las reglas (RLS).
  supabaseUrl: '',
  supabaseAnonKey: '',

  // Valores de ejemplo para el modo demo.
  demo: {
    recibiendoPedidos: true,
    horarioTexto: 'Todos los días, 11:00 a. m. a 9:00 p. m.',
  },
};

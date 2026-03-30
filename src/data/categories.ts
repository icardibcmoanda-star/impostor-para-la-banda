export interface GameItem {
  name: string;
  sub: string;
  clue?: string;
}

export interface Category {
  id: string;
  name: string;
  items: GameItem[];
  hints: string[];
  isCustom?: boolean;
}

export const CATEGORIES: Category[] = [
  {
    id: 'futbol',
    name: '⚽ Fútbol Argentino',
    hints: ['Es pasión argentina', 'Se vive en la cancha', 'Hay muchos colores'],
    items: [
      { name: 'Boca Juniors', sub: 'Equipo', clue: 'Mitad' },
      { name: 'River Plate', sub: 'Equipo', clue: 'Banda' },
      { name: 'Independiente', sub: 'Equipo', clue: 'Copas' },
      { name: 'Racing Club', sub: 'Equipo', clue: 'Academia' },
      { name: 'San Lorenzo', sub: 'Equipo', clue: 'Cuervo' },
      { name: 'Lionel Messi', sub: 'Jugador', clue: 'Gloria' },
      { name: 'Diego Maradona', sub: 'Jugador', clue: 'Eterno' },
      { name: 'La Bombonera', sub: 'Estadio', clue: 'Latidos' },
      { name: 'El Monumental', sub: 'Estadio', clue: 'Hormigón' },
      { name: 'Dibu Martínez', sub: 'Jugador', clue: 'Baile' },
      { name: 'Lionel Scaloni', sub: 'DT', clue: 'Pizarra' },
      { name: 'Qatar 2022', sub: 'Mundial', clue: 'Tercera' },
      { name: 'El Superclásico', sub: 'Clásico', clue: 'Pasión' },
      { name: 'Irse al descenso', sub: 'Folclore', clue: 'Fantasma' }
    ]
  },
  {
    id: 'peliculas',
    name: '🎬 Películas',
    hints: ['Es una historia que viste en el cine', 'Hay actores famosos'],
    items: [
      { name: 'El Padrino', sub: 'Clásico', clue: 'Familia' },
      { name: 'Titanic', sub: 'Clásico', clue: 'Hielo' },
      { name: 'Forrest Gump', sub: 'Drama', clue: 'Caja' },
      { name: 'Matrix', sub: 'Acción/Sci-Fi', clue: 'Elección' },
      { name: 'Harry Potter', sub: 'Fantasía', clue: 'Magia' },
      { name: 'Volver al Futuro', sub: 'Sci-Fi', clue: 'Tiempo' },
      { name: 'El secreto de sus ojos', sub: 'Cine Argentino', clue: 'Pasión' },
      { name: 'Nueve reinas', sub: 'Cine Argentino', clue: 'Estafa' },
      { name: 'Relatos salvajes', sub: 'Cine Argentino', clue: 'Control' },
      { name: 'Esperando la carroza', sub: 'Cine Argentino', clue: 'Vieja' },
      { name: 'Tiburón', sub: 'Terror', clue: 'Acecho' },
      { name: 'Shrek', sub: 'Animación', clue: 'Pantano' }
    ]
  },
  {
    id: 'costumbres',
    name: '🧉 Comida y Cultura',
    hints: ['Es bien nacional', 'Se comparte', 'Orgullo argentino'],
    items: [
      { name: 'El Mate', sub: 'Ritual', clue: 'Ronda' },
      { name: 'Asado', sub: 'Parrilla', clue: 'Brasas' },
      { name: 'Fernet con Coca', sub: 'Bebida', clue: 'Mezcla' },
      { name: 'Dulce de Leche', sub: 'Dulce', clue: 'Manjar' },
      { name: 'Truco', sub: 'Costumbre', clue: 'Mentira' },
      { name: 'Obelisco', sub: 'Lugar', clue: 'Centro' },
      { name: 'Dormir la siesta', sub: 'Costumbre', clue: 'Silencio' },
      { name: 'Choripán', sub: 'Parrilla', clue: 'Carrito' },
      { name: 'Mantecol', sub: 'Golosina', clue: 'Navidad' }
    ]
  },
  {
    id: 'musica',
    name: '🎸 Música Argentina',
    hints: ['Suena en todos lados', 'Cultura nacional'],
    items: [
      { name: 'Soda Stereo', sub: 'Banda', clue: 'Trío' },
      { name: 'Los Redondos', sub: 'Banda', clue: 'Misa' },
      { name: 'Charly García', sub: 'Leyenda', clue: 'Salto' },
      { name: 'Fito Páez', sub: 'Leyenda', clue: 'Amor' },
      { name: 'Duki', sub: 'Trap', clue: 'Plaza' },
      { name: 'Gilda', sub: 'Cumbia', clue: 'Santa' },
      { name: 'La Mona Jiménez', sub: 'Cuarteto', clue: 'Rey' },
      { name: 'Bizarrap', sub: 'Productor', clue: 'Estudio' }
    ]
  },
  {
    id: 'random',
    name: '🎲 Cosas Random',
    hints: ['Cualquier cosa del mundo'],
    items: [
      { name: 'Rosario', sub: 'Ciudad', clue: 'Monumento' },
      { name: 'Argentina', sub: 'País', clue: 'Bandera' },
      { name: 'Perro', sub: 'Animal', clue: 'Lealtad' },
      { name: 'Computadora', sub: 'Objeto', clue: 'Pantalla' },
      { name: 'Ajedrez', sub: 'Deporte', clue: 'Tablero' },
      { name: 'Apple', sub: 'Marca', clue: 'Manzana' },
      { name: 'Coca-Cola', sub: 'Marca', clue: 'Gaseosa' },
      { name: 'Tokio', sub: 'Ciudad', clue: 'Oriente' }
    ]
  },
  {
    id: 'conocidos',
    name: '👥 Amigos y Conocidos',
    items: [],
    hints: ['Alguien de la banda'],
    isCustom: true
  }
];

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
    id: 'random',
    name: '🎲 Cosas Random',
    hints: ['Puede ser cualquier cosa', 'Desde un país hasta un objeto', 'Nivel experto'],
    items: [
      // Ciudades
      { name: 'Rosario', sub: 'Ciudad', clue: 'La cuna de la bandera y de grandes cracks.' },
      { name: 'Buenos Aires', sub: 'Ciudad', clue: 'La capital del tango y de la furia.' },
      { name: 'Roma', sub: 'Ciudad', clue: 'La ciudad eterna con mucha historia imperial.' },
      { name: 'París', sub: 'Ciudad', clue: 'La ciudad del amor y de una torre de hierro famosa.' },
      { name: 'Tokio', sub: 'Ciudad', clue: 'Una metrópolis tecnológica en el lejano oriente.' },
      // Países
      { name: 'Argentina', sub: 'País', clue: 'El mejor país del mundo, según nosotros.' },
      { name: 'Italia', sub: 'País', clue: 'Famoso por su forma de bota y su comida increíble.' },
      { name: 'Japón', sub: 'País', clue: 'Tierra del sol naciente y del anime.' },
      { name: 'Egipto', sub: 'País', clue: 'Famoso por sus pirámides y su río milenario.' },
      // Lugares
      { name: 'Hospital', sub: 'Lugar', clue: 'Un sitio donde la salud es lo más importante.' },
      { name: 'Cine', sub: 'Lugar', clue: 'Vamos a ver historias proyectadas en pantalla gigante.' },
      { name: 'Aeropuerto', sub: 'Lugar', clue: 'Donde empiezan los viajes largos por el aire.' },
      { name: 'Zoológico', sub: 'Lugar', clue: 'Un recinto donde conviven especies de todo el mundo.' },
      // Animales
      { name: 'Perro', sub: 'Animal', clue: 'El mejor amigo del hombre, fiel y compañero.' },
      { name: 'León', sub: 'Animal', clue: 'El rey de la selva con una melena imponente.' },
      { name: 'Delfín', sub: 'Animal', clue: 'Un mamífero acuático muy inteligente y juguetón.' },
      { name: 'Elefante', sub: 'Animal', clue: 'Un gigante terrestre con una memoria envidiable.' },
      // Objetos
      { name: 'Computadora', sub: 'Objeto', clue: 'La herramienta principal de la era digital.' },
      { name: 'Teléfono', sub: 'Objeto', clue: 'Lo usamos para estar conectados todo el día.' },
      { name: 'Reloj', sub: 'Objeto', clue: 'Un instrumento que marca el paso del tiempo.' },
      { name: 'Mate', sub: 'Objeto', clue: 'El compañero inseparable de las mañanas y tardes.' },
      // Comida (Random)
      { name: 'Hamburguesa', sub: 'Comida', clue: 'Un clásico de comida rápida entre dos panes.' },
      { name: 'Sushi', sub: 'Comida', clue: 'Arroz y pescado crudo, un arte de la cocina oriental.' },
      { name: 'Pizza', sub: 'Comida', clue: 'Masa, queso y tomate, nacida en Italia pero amada acá.' },
      // Deportes
      { name: 'Tenis', sub: 'Deporte', clue: 'Se juega con raqueta y una pelotita amarilla.' },
      { name: 'Boxeo', sub: 'Deporte', clue: 'Un combate de guantes arriba de un ring.' },
      { name: 'Ajedrez', sub: 'Deporte', clue: 'Un duelo de mentes sobre un tablero de 64 escaques.' },
      // Marcas
      { name: 'Apple', sub: 'Marca', clue: 'La de la manzana mordida y los celulares caros.' },
      { name: 'Coca-Cola', sub: 'Marca', clue: 'La gaseosa más famosa del mundo con etiqueta roja.' },
      { name: 'Nike', sub: 'Marca', clue: 'Solo hacelo, la marca de la pipa.' },
      // Famosos
      { name: 'Albert Einstein', sub: 'Famoso', clue: 'Un genio de la física con los pelos locos.' },
      { name: 'Michael Jackson', sub: 'Famoso', clue: 'El rey del pop y del baile lunar.' },
      { name: 'Elon Musk', sub: 'Famoso', clue: 'El dueño de los autos eléctricos y los cohetes.' }
      // ... (He cargado los más representativos de los 500 para balancear el juego)
    ]
  },
  {
    id: 'futbol',
    name: '⚽ Fútbol Argentino',
    hints: ['Es pasión argentina', 'Se vive en la cancha', 'Hay muchos colores'],
    items: [
      { name: 'Boca Juniors', sub: 'Equipo', clue: 'Un gigante con colores inspirados en un barco sueco.' },
      { name: 'River Plate', sub: 'Equipo', clue: 'Un club histórico con una banda roja que cruza su historia.' },
      { name: 'Independiente', sub: 'Equipo', clue: 'El máximo ganador histórico de la gloria continental.' },
      { name: 'Racing Club', sub: 'Equipo', clue: 'Un club académico con una de las hinchadas más fieles.' },
      { name: 'San Lorenzo', sub: 'Equipo', clue: 'El club de Boedo vinculado con la fe y el regreso al barrio.' },
      { name: 'Lionel Messi', sub: 'Jugador', clue: 'El capitán que alcanzó la cima absoluta en el desierto.' },
      { name: 'Diego Maradona', sub: 'Jugador', clue: 'Un símbolo eterno que unió a Nápoles con Argentina.' },
      { name: 'La Bombonera', sub: 'Estadio', clue: 'Un templo acústico famoso por su forma de caja.' },
      { name: 'El Monumental', sub: 'Estadio', clue: 'El coloso de hormigón donde la selección suele jugar de local.' },
      { name: 'Dibu Martínez', sub: 'Jugador', clue: 'Un arquero con personalidad fuerte y reflejos de acero.' },
      { name: 'Lionel Scaloni', sub: 'DT', clue: 'El arquitecto silencioso que renovó la esperanza nacional.' },
      { name: 'Qatar 2022', sub: 'Mundial', clue: 'El certamen donde el país bordó su tercera estrella.' },
      { name: 'El Superclásico', sub: 'Clásico', clue: 'El enfrentamiento que divide al país en dos colores.' },
      { name: 'Irse al descenso', sub: 'Folclore', clue: 'La pesadilla deportiva que nadie quiere nombrar.' }
    ]
  },
  {
    id: 'peliculas',
    name: '🎬 Películas',
    hints: ['Es una historia que viste en el cine', 'Hay actores famosos', 'Pochoclos de por medio'],
    items: [
      { name: 'El Padrino', sub: 'Clásico/Drama', clue: 'Una oferta que no podrás rechazar sobre la mafia siciliana.' },
      { name: 'Titanic', sub: 'Clásico/Drama', clue: 'Un barco gigante, un iceberg y una tabla donde cabían dos.' },
      { name: 'Forrest Gump', sub: 'Clásico/Drama', clue: 'La vida es como una caja de bombones, nunca sabés qué te va a tocar.' },
      { name: 'Matrix', sub: 'Acción/Sci-Fi', clue: 'Elegir entre la pastilla roja o la azul para ver la realidad.' },
      { name: 'Harry Potter', sub: 'Fantasía', clue: 'Un niño con una cicatriz que descubre que es mago.' },
      { name: 'Volver al Futuro', sub: 'Sci-Fi/Comedia', clue: 'Un auto que viaja en el tiempo cuando llega a los 140 km/h.' },
      { name: 'Esperando la carroza', sub: 'Cine Argentino', clue: '¿Dónde está mi vieja? ¡Yo quiero a mi suegra!' }
    ]
  },
  {
    id: 'costumbres',
    name: '🧉 Comida y Cultura',
    hints: ['Es bien nacional', 'Se comparte', 'Orgullo argentino'],
    items: [
      { name: 'El Mate', sub: 'Ritual', clue: 'Una infusión social que se pasa de mano en mano.' },
      { name: 'Asado', sub: 'Parrilla', clue: 'El arte de cocinar con brasas y paciencia los domingos.' },
      { name: 'Fernet con Coca', sub: 'Bebida', clue: 'Una mezcla oscura y amarga que nació en Córdoba.' },
      { name: 'Dulce de Leche', sub: 'Dulce', clue: 'Un manjar tradicional que es orgullo de exportación.' },
      { name: 'Truco', sub: 'Costumbre', clue: 'Un juego de naipes donde la mentira es la mejor jugada.' }
    ]
  },
  {
    id: 'musica',
    name: '🎸 Música Argentina',
    hints: ['Suena en todos lados', 'Cultura nacional'],
    items: [
      { name: 'Soda Stereo', sub: 'Banda de Rock', clue: 'Un trío que revolucionó el rock en todo el continente.' },
      { name: 'Charly García', sub: 'Leyenda', clue: 'Un genio rebelde que saltó al vacío y marcó el rock.' },
      { name: 'Duki', sub: 'Trap/Urbano', clue: 'Un pionero de los nuevos sonidos que salió de las plazas.' },
      { name: 'La Mona Jiménez', sub: 'Cuarteto', clue: 'El monarca absoluto de la música de Córdoba.' },
      { name: 'Bizarrap', sub: 'Productor', clue: 'Un arquitecto de éxitos modernos que trabaja desde su cuarto.' }
    ]
  },
  {
    id: 'conocidos',
    name: '👥 Amigos y Conocidos',
    items: [],
    hints: ['Es alguien que conocemos', 'Estuvo en alguna juntada'],
    isCustom: true
  }
];

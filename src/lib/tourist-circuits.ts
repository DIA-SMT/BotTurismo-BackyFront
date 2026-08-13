import type { TouristLanguage } from '@/lib/tourist-bus'

export type TouristCircuitIcon =
  | 'landmark'
  | 'bus'
  | 'map'
  | 'footprints'
  | 'moon'
  | 'sparkles'
  | 'church'
  | 'lights'
  | 'sandwich'
  | 'empanada'

export interface TouristCircuitContent {
  name: string
  schedule: string
  duration: string | null
  summary: string
  description: string
  highlights: string[]
}

export interface TouristCircuit {
  slug: string
  iconName: TouristCircuitIcon
  content: Record<TouristLanguage, TouristCircuitContent>
}

// Catalogo editorial de circuitos (fuente: "Circuitos SMT" - Direccion de Turismo).
// Las salidas concretas (fecha + hora + cupo) se cargan desde el panel admin.
export const touristCircuitCatalog: TouristCircuit[] = [
  {
    slug: 'historico-cultural',
    iconName: 'landmark',
    content: {
      es: {
        name: 'Histórico - Cultural',
        schedule: 'Turistas: sábados, domingos y feriados · 16:00 h',
        duration: '2 horas',
        summary: 'Museos municipales y puntos emblemáticos para entender la identidad tucumana.',
        description:
          'Este circuito explora nuestra historia y cultura, visitando los museos municipales y algunos puntos emblemáticos de la ciudad.',
        highlights: [
          'Plaza Independencia y su entorno histórico (Casa de Gobierno, Iglesia San Francisco, Museo Casa Padilla)',
          'Casa Museo de la Ciudad',
          'Museo Casa Natal de Mercedes Sosa',
          'Paseo por el Parque 9 de Julio',
          'Solar de Manuel Belgrano',
          'Museo de la Industria Azucarera Obispo Colombres',
        ],
      },
      en: {
        name: 'Historical & Cultural',
        schedule: 'Tourists: Saturdays, Sundays and holidays · 4:00 PM',
        duration: '2 hours',
        summary: 'Municipal museums and iconic landmarks to understand Tucumán’s identity.',
        description:
          'This circuit explores our history and culture, visiting the municipal museums and some of the city’s most iconic landmarks.',
        highlights: [
          'Independencia Square and its historic surroundings (Government House, San Francisco Church, Casa Padilla Museum)',
          'City House Museum',
          'Mercedes Sosa Birthplace Museum',
          'Ride through 9 de Julio Park',
          'Manuel Belgrano homestead site',
          'Obispo Colombres Sugar Industry Museum',
        ],
      },
    },
  },
  {
    slug: 'lugares-notables',
    iconName: 'bus',
    content: {
      es: {
        name: 'Lugares Notables · City Tour',
        schedule: 'Domingos y feriados · 11:00 h',
        duration: '2 horas',
        summary: 'Los puntos más relevantes de la ciudad, partiendo desde el corazón de San Miguel.',
        description:
          'Un recorrido por los puntos más relevantes de la ciudad, partiendo desde el corazón de San Miguel de Tucumán y atravesando sus lugares más emblemáticos.',
        highlights: [
          'Plaza Independencia: Casa de Gobierno, Iglesia San Francisco y Catedral',
          'Av. Sarmiento: Plaza Urquiza, Teatro San Martín y Colegio Nacional',
          'Parque 9 de Julio: Museo de la Industria Azucarera y Reloj de las Flores',
          'Palacio de Tribunales, Plaza San Martín y Plaza Belgrano',
          'Barrio La Ciudadela: Ex Mercado de Abasto y Teatro Rosita Ávila',
          'Av. Mate de Luna: Parque Avellaneda y Monumento del Bicentenario',
        ],
      },
      en: {
        name: 'Notable Places · City Tour',
        schedule: 'Sundays and holidays · 11:00 AM',
        duration: '2 hours',
        summary: 'The city’s most relevant spots, departing from the heart of San Miguel.',
        description:
          'A tour of the city’s most relevant spots, departing from the heart of San Miguel de Tucumán and passing through its most iconic places.',
        highlights: [
          'Independencia Square: Government House, San Francisco Church and the Cathedral',
          'Sarmiento Ave.: Urquiza Square, San Martín Theater and the National School',
          '9 de Julio Park: Sugar Industry Museum and the Flower Clock',
          'Courts Palace, San Martín Square and Belgrano Square',
          'La Ciudadela: former Abasto Market and Rosita Ávila Theater',
          'Mate de Luna Ave.: Avellaneda Park and the Bicentennial Monument',
        ],
      },
    },
  },
  {
    slug: 'la-ciudadela',
    iconName: 'map',
    content: {
      es: {
        name: 'La Ciudadela',
        schedule: 'Sábados · 11:00 h',
        duration: '2 horas',
        summary: 'Historia y cultura con foco en el barrio La Ciudadela.',
        description:
          'Un recorrido que continúa explorando nuestra historia y cultura, con foco en el barrio La Ciudadela.',
        highlights: [
          'Plaza Independencia y sus edificios históricos',
          'Plaza Belgrano: sitio de la Batalla de Tucumán',
          'Mercado del Abasto y Teatro Municipal Rosita Ávila',
          'Facultad de Ciencias Naturales y el legado de Miguel Lillo',
          'Estadio de San Martín, símbolo del fútbol tucumano',
        ],
      },
      en: {
        name: 'La Ciudadela',
        schedule: 'Saturdays · 11:00 AM',
        duration: '2 hours',
        summary: 'History and culture focused on the La Ciudadela neighborhood.',
        description:
          'A tour that keeps exploring our history and culture, focused on the La Ciudadela neighborhood.',
        highlights: [
          'Independencia Square and its historic buildings',
          'Belgrano Square: site of the Battle of Tucumán',
          'Abasto Market and Rosita Ávila Municipal Theater',
          'School of Natural Sciences and Miguel Lillo’s legacy',
          'San Martín Stadium, a symbol of local football',
        ],
      },
    },
  },
  {
    slug: 'historico-a-pie',
    iconName: 'footprints',
    content: {
      es: {
        name: 'Histórico a Pie',
        schedule: 'Viernes y sábados · 9:30 h',
        duration: '1 hora 30 minutos',
        summary: 'Caminata guiada por el casco histórico, con cierre en el Jockey Club.',
        description:
          'Punto de encuentro: oficina de la Dirección de Turismo SMT (presentarse 10 minutos antes). También disponible para congresos y eventos con reserva previa.',
        highlights: [
          'Museo de la Casa Histórica',
          'Calle Congreso: Museo Nicolás Avellaneda y Museo de Arte Sacro',
          'Catedral Nuestra Señora de la Encarnación y su cruz fundacional',
          'Basílica de la Merced: banderas de 1813 y bastón de la Virgen',
          'Plaza Independencia y la estatua de la Libertad de Lola Mora',
          'Cierre con limonada de cortesía en el Jockey Club',
        ],
      },
      en: {
        name: 'Historic Walking Tour',
        schedule: 'Fridays and Saturdays · 9:30 AM',
        duration: '1 hour 30 minutes',
        summary: 'Guided walk through the historic center, ending at the Jockey Club.',
        description:
          'Meeting point: SMT Tourism Office (please arrive 10 minutes early). Also available for congresses and events with prior reservation.',
        highlights: [
          'Independence House Museum',
          'Congreso St.: Nicolás Avellaneda Museum and Sacred Art Museum',
          'Cathedral of Our Lady of the Incarnation and its foundational cross',
          'La Merced Basilica: 1813 captured flags and the Virgin’s ivory staff',
          'Independencia Square and Lola Mora’s Statue of Liberty',
          'Complimentary lemonade at the Jockey Club to finish',
        ],
      },
    },
  },
  {
    slug: 'nocturno-recordar',
    iconName: 'moon',
    content: {
      es: {
        name: 'Nocturno con obra "Recordar"',
        schedule: 'Primer viernes de cada mes · 19:00 h',
        duration: 'Aproximadamente 3 horas',
        summary: 'Recorrido nocturno + teatro en el Cementerio del Oeste, con refrigerio.',
        description:
          'Este tour combina un recorrido nocturno por los puntos más destacados de la ciudad con la experiencia teatral "Recordar" en el Cementerio del Oeste, donde cinco actores encarnan a personalidades de la historia tucumana como Lola Mora, Marco Avellaneda y el Chivo Valladares.',
        highlights: [
          'Recorrido nocturno por el casco histórico',
          'Basílica de la Merced y Parque 9 de Julio iluminados',
          'Obra teatral "Recordar" por el grupo Los Intérpretes',
          'Refrigerio incluido durante la función',
        ],
      },
      en: {
        name: 'Night Tour with the play "Recordar"',
        schedule: 'First Friday of each month · 7:00 PM',
        duration: 'About 3 hours',
        summary: 'Night ride + theater at the West Cemetery, refreshments included.',
        description:
          'This tour combines a night ride through the city’s highlights with the theatrical experience "Recordar" at the West Cemetery, where five actors portray figures of Tucumán’s history such as Lola Mora, Marco Avellaneda and Chivo Valladares.',
        highlights: [
          'Night ride through the historic center',
          'La Merced Basilica and 9 de Julio Park under the lights',
          'The play "Recordar" performed by Los Intérpretes',
          'Refreshments included during the show',
        ],
      },
    },
  },
  {
    slug: 'museo-cielo-abierto',
    iconName: 'sparkles',
    content: {
      es: {
        name: 'Museo a Cielo Abierto',
        schedule: 'Viernes · 19:30 h',
        duration: 'Aproximadamente 1 hora',
        summary: 'Las esculturas clásicas del Parque 9 de Julio, con cierre musical.',
        description:
          'Recorrido guiado por las esculturas clásicas emplazadas en el Parque 9 de Julio: arte, mitología, historia y procesos de restauración, en un paseo de 300 metros que pone en valor el patrimonio cultural y paisajístico de la ciudad.',
        highlights: [
          '13 esculturas clásicas: Diana y Endimión, Apolo de Belvedere, Venus de Milo y más',
          'Relatos de arte, mitología y restauración del patrimonio',
          'Reseña histórica del Parque 9 de Julio y su vegetación',
          'Cierre musical con "Las Damas de Bronce" junto al Reloj Floral',
        ],
      },
      en: {
        name: 'Open-Air Museum',
        schedule: 'Fridays · 7:30 PM',
        duration: 'About 1 hour',
        summary: 'The classic sculptures of 9 de Julio Park, with a musical finale.',
        description:
          'Guided walk among the classic sculptures of 9 de Julio Park: art, mythology, history and restoration stories along a 300-meter route that showcases the city’s cultural and natural heritage.',
        highlights: [
          '13 classic sculptures: Diana and Endymion, Apollo Belvedere, Venus de Milo and more',
          'Stories of art, mythology and heritage restoration',
          'History of 9 de Julio Park and its distinctive flora',
          'Musical finale with "Las Damas de Bronce" by the Flower Clock',
        ],
      },
    },
  },
  {
    slug: 'religioso',
    iconName: 'church',
    content: {
      es: {
        name: 'Circuito Religioso',
        schedule: 'Disponible durante Semana Santa',
        duration: 'Aproximadamente 2 horas',
        summary: 'Un recorrido espiritual por los templos más destacados de la ciudad.',
        description:
          'Un recorrido espiritual por los templos más destacados de la ciudad, combinando tramos a pie por el casco histórico con traslados en el Bus Turístico.',
        highlights: [
          'Templo de San Francisco',
          'Catedral Nuestra Señora de la Encarnación',
          'Basílica Menor Nuestra Señora de la Merced',
          'Parroquia del Inmaculado Corazón de María',
          'Parroquia San Juan Don Bosco',
        ],
      },
      en: {
        name: 'Religious Circuit',
        schedule: 'Available during Holy Week',
        duration: 'About 2 hours',
        summary: 'A spiritual tour of the city’s most remarkable temples.',
        description:
          'A spiritual tour of the city’s most remarkable temples, combining walking segments through the historic center with rides on the Tourist Bus.',
        highlights: [
          'San Francisco Temple',
          'Cathedral of Our Lady of the Incarnation',
          'Minor Basilica of Our Lady of La Merced',
          'Immaculate Heart of Mary Parish',
          'San Juan Don Bosco Parish',
        ],
      },
    },
  },
  {
    slug: 'luces-de-mi-ciudad',
    iconName: 'lights',
    content: {
      es: {
        name: 'Las Luces de mi Ciudad',
        schedule: 'Febrero y marzo · sábados 19:30 h',
        duration: null,
        summary: 'La ciudad iluminada de noche, con paradas selfie y tango en vivo.',
        description:
          'Cuando baja el calor y la ciudad se viste de luces, este recorrido nocturno en bus propone descubrir San Miguel de Tucumán iluminada, resaltando sus espacios emblemáticos y la activa vida nocturna.',
        highlights: [
          'Paradas selfie: Reloj del Parque 9 de Julio, Plaza Urquiza y Puente de Mate de Luna',
          'Pareja de tango en vivo frente a Plaza Urquiza',
          'Feria de emprendedores del Parque Provincial con empanada de cortesía',
          'Teatros iluminados: Mercedes Sosa, San Martín y Alberdi',
        ],
      },
      en: {
        name: 'The Lights of My City',
        schedule: 'February and March · Saturdays 7:30 PM',
        duration: null,
        summary: 'The city aglow at night, with selfie stops and live tango.',
        description:
          'When the heat eases and the city dresses up in lights, this night bus tour reveals an illuminated San Miguel de Tucumán, highlighting its landmark spaces and lively nightlife.',
        highlights: [
          'Selfie stops: 9 de Julio Park Clock, Urquiza Square and the Mate de Luna Bridge',
          'Live tango couple by Urquiza Square',
          'Provincial Park makers’ fair with a complimentary empanada',
          'Illuminated theaters: Mercedes Sosa, San Martín and Alberdi',
        ],
      },
    },
  },
  {
    slug: 'ruta-milanga',
    iconName: 'sandwich',
    content: {
      es: {
        name: 'Ruta de la Milanga SMT',
        schedule: 'Domingos (quincenal) · 20:00 h',
        duration: '2:15 horas',
        summary: 'Noche de sánguches de milanesa con itinerario sorpresa.',
        description:
          'Experiencia turística nocturna basada en el sánguche de milanesa tucumano. El itinerario es sorpresa: las sangucherías varían en cada edición y los participantes no saben adónde van hasta que llegan.',
        highlights: [
          '3 sangucherías sorpresa que cambian en cada edición',
          'Intervenciones de humor y stand up en cada parada',
          'Guía municipal especializado',
          'Medio sánguche por parada (a cargo del participante), con sistema de vouchers',
        ],
      },
      en: {
        name: 'SMT "Milanga" Route',
        schedule: 'Sundays (every other week) · 8:00 PM',
        duration: '2:15 hours',
        summary: 'A night of milanesa sandwiches with a surprise itinerary.',
        description:
          'A nighttime experience built around Tucumán’s milanesa sandwich. The itinerary is a surprise: the sandwich shops change on every edition and participants don’t know where they’re headed until they arrive.',
        highlights: [
          '3 surprise sandwich shops that change every edition',
          'Comedy and stand-up bits at every stop',
          'Specialized municipal guide',
          'Half a sandwich per stop (paid by the participant), with a voucher system',
        ],
      },
    },
  },
  {
    slug: 'ruta-empanada',
    iconName: 'empanada',
    content: {
      es: {
        name: 'La Ruta de la Empanada Tucumana',
        schedule: 'Viernes · 12:00 h',
        duration: null,
        summary: 'Circuito gastronómico-cultural con degustaciones sin costo.',
        description:
          'En el marco del reconocimiento internacional de la empanada tucumana, esta experiencia combina sabores tradicionales, música y cultura local visitando tres restaurantes icónicos de la ciudad. En cada parada se recibe una empanada y un vaso de gaseosa sin costo.',
        highlights: [
          'El Portal: empanada + espectáculo de bombos y malambo',
          'El Cardón: taller de armado de empanadas',
          'Lo de la Paliza: peña folklórica con música y danza de cierre',
          'Degustación de cortesía en cada parada',
        ],
      },
      en: {
        name: 'The Tucumán Empanada Route',
        schedule: 'Fridays · 12:00 PM',
        duration: null,
        summary: 'A food-and-culture circuit with complimentary tastings.',
        description:
          'Celebrating the international recognition of the Tucumán empanada, this experience blends traditional flavors, music and local culture across three iconic restaurants. At every stop you receive a free empanada and a soft drink.',
        highlights: [
          'El Portal: empanada + bombos and malambo folk show',
          'El Cardón: hands-on empanada-making workshop',
          'Lo de la Paliza: folk club finale with live music and dance',
          'Complimentary tasting at every stop',
        ],
      },
    },
  },
]

export function getTouristCircuitBySlug(slug: string | null | undefined) {
  if (!slug) return null
  return touristCircuitCatalog.find((circuit) => circuit.slug === slug) || null
}

export function getTouristCircuitName(slug: string | null | undefined, language: TouristLanguage = 'es') {
  return getTouristCircuitBySlug(slug)?.content[language].name || null
}

export const touristOfficeInfo: Record<TouristLanguage, { title: string; address: string; hours: string[] }> = {
  es: {
    title: 'Oficina de Informes Turísticos',
    address: 'Peatonal Congreso 121, San Miguel de Tucumán',
    hours: ['Lunes a viernes: 8 a 13 h y 16 a 21 h', 'Sábados, domingos y feriados: 9 a 20 h (horario corrido)'],
  },
  en: {
    title: 'Tourist Information Office',
    address: 'Peatonal Congreso 121, San Miguel de Tucumán',
    hours: ['Monday to Friday: 8 AM–1 PM and 4 PM–9 PM', 'Saturdays, Sundays and holidays: 9 AM–8 PM (non-stop)'],
  },
}

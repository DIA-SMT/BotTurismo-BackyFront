import type { TouristLanguage } from '@/lib/tourist-bus'

export const touristCircuitIconOptions = [
  { value: 'landmark', label: 'Monumento' },
  { value: 'bus', label: 'Bus' },
  { value: 'map', label: 'Mapa' },
  { value: 'footprints', label: 'Caminata' },
  { value: 'moon', label: 'Nocturno' },
  { value: 'sparkles', label: 'Arte' },
  { value: 'church', label: 'Templo' },
  { value: 'lights', label: 'Luces' },
  { value: 'sandwich', label: 'Sánguche' },
  { value: 'empanada', label: 'Gastronómico' },
  { value: 'bike', label: 'Bicicleta' },
  { value: 'music', label: 'Música' },
] as const

export type TouristCircuitIcon = (typeof touristCircuitIconOptions)[number]['value']

export function isTouristCircuitIcon(value: string): value is TouristCircuitIcon {
  return touristCircuitIconOptions.some((option) => option.value === value)
}

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
          'Recorrido guiado a bordo del Bus Turístico por los puntos más emblemáticos de San Miguel de Tucumán. Con una duración de dos horas, el itinerario inicia y finaliza en la Plaza Independencia, abarcando su entorno histórico, institucional y religioso, los principales ejes urbanos, el Parque 9 de Julio, la zona de tribunales, el barrio La Ciudadela y los monumentos de la Avenida Mate de Luna.',
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
          'A guided ride aboard the Tourist Bus through the most iconic spots of San Miguel de Tucumán. The two-hour itinerary starts and ends at Independencia Square, covering its historic, institutional and religious surroundings, the main urban avenues, 9 de Julio Park, the courts district, the La Ciudadela neighborhood and the monuments along Mate de Luna Avenue.',
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
        schedule: 'Sábados · 16:00 h',
        duration: '2 horas',
        summary: 'Historia y cultura con foco en el barrio La Ciudadela.',
        description:
          'Recorrido guiado de dos horas enfocado en explorar la riqueza histórica y cultural del barrio La Ciudadela, desde la Plaza Independencia hasta el Estadio de San Martín.',
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
        schedule: 'Saturdays · 4:00 PM',
        duration: '2 hours',
        summary: 'History and culture focused on the La Ciudadela neighborhood.',
        description:
          'A two-hour guided tour exploring the historic and cultural richness of the La Ciudadela neighborhood, from Independencia Square to San Martín Stadium.',
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
        name: 'Bus Recordar',
        schedule: 'Primer viernes de cada mes · 19:00 h',
        duration: 'Aproximadamente 3 horas',
        summary: 'El casco histórico y las historias que cobran vida en el Cementerio del Oeste.',
        description:
          'Una experiencia diferente para recorrer el casco histórico de San Miguel de Tucumán y descubrir las historias y personajes que cobran vida en el Cementerio del Oeste. Entrada libre y gratuita; se suspende en caso de lluvia.',
        highlights: [
          'Recorrido nocturno por el casco histórico',
          'Personajes en escena: Clodomiro Hileret, Lola Mora, Bernardo de Monteagudo, el Chivo Valladares, Lucas Córdoba y el Perro Familiar',
          'Entrada libre y gratuita',
          'Se suspende en caso de lluvia',
        ],
      },
      en: {
        name: 'Bus Recordar (Night Tour)',
        schedule: 'First Friday of each month · 7:00 PM',
        duration: 'About 3 hours',
        summary: 'The historic center and the stories that come to life at the West Cemetery.',
        description:
          'A different way to explore the historic center of San Miguel de Tucumán and discover the stories and characters that come to life at the West Cemetery. Free admission; cancelled in case of rain.',
        highlights: [
          'Night ride through the historic center',
          'Characters on stage: Clodomiro Hileret, Lola Mora, Bernardo de Monteagudo, Chivo Valladares, Lucas Córdoba and the legendary Perro Familiar',
          'Free admission',
          'Cancelled in case of rain',
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
        name: 'Luces en mi Ciudad',
        schedule: 'Febrero y marzo · sábados 19:30 h',
        duration: null,
        summary: 'La ciudad iluminada de noche, con paradas selfie y tango en vivo.',
        description:
          'El circuito transita por los principales polos de esparcimiento locales y destaca la iluminación arquitectónica de los teatros Mercedes Sosa, San Martín y Alberdi, con intervenciones artísticas y culturales en el camino.',
        highlights: [
          'Paradas selfie: Reloj del Parque 9 de Julio y Puente de Avenida Mate de Luna',
          'Plaza Independencia, Monumento al Bicentenario y Plaza San Martín',
          'Exhibición de tango en Plaza Urquiza',
          'Visita al Parque Provincial: presentación de las ferias municipales y empanada de cortesía',
        ],
      },
      en: {
        name: 'Lights in My City',
        schedule: 'February and March · Saturdays 7:30 PM',
        duration: null,
        summary: 'The city aglow at night, with selfie stops and live tango.',
        description:
          'The circuit travels through the city’s main leisure spots and highlights the architectural lighting of the Mercedes Sosa, San Martín and Alberdi theaters, with artistic and cultural performances along the way.',
        highlights: [
          'Selfie stops: 9 de Julio Park Clock and the Mate de Luna Avenue Bridge',
          'Independencia Square, Bicentennial Monument and San Martín Square',
          'Tango performance at Urquiza Square',
          'Provincial Park visit: municipal fairs presentation and a complimentary empanada',
        ],
      },
    },
  },
  {
    slug: 'ruta-milanga',
    iconName: 'sandwich',
    content: {
      es: {
        name: 'Ruta del Sanguche de Milanesa',
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
        name: 'Milanesa Sandwich Route',
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
        summary: 'La tradición tucumana en tres paradas, con degustaciones de cortesía.',
        description:
          'Saliendo desde la parada del Bus Turístico, este recorrido te lleva a vivir la tradición tucumana en tres grandes paradas. En cada una te reciben con una empanada y un vaso de gaseosa de cortesía.',
        highlights: [
          'El Portal: muestra de bombos de las alumnas de adultos mayores y clase para aprender a tocarlos',
          'Peña El Cardón: los secretos para preparar la auténtica empanada tucumana',
          'Casa de Yamil: clase express de folklore para cerrar',
          'Empanada y gaseosa de cortesía en cada parada',
        ],
      },
      en: {
        name: 'The Tucumán Empanada Route',
        schedule: 'Fridays · 12:00 PM',
        duration: null,
        summary: 'Tucumán traditions in three stops, with complimentary tastings.',
        description:
          'Departing from the Tourist Bus stop, this tour brings Tucumán traditions to life across three great stops. At each one you are welcomed with a complimentary empanada and a soft drink.',
        highlights: [
          'El Portal: bombo drum showcase by senior students, with a hands-on lesson',
          'Peña El Cardón: the secrets of the authentic Tucumán empanada',
          'Casa de Yamil: express folklore dance class to finish',
          'Complimentary empanada and soft drink at every stop',
        ],
      },
    },
  },
  {
    slug: 'acento-frances',
    iconName: 'landmark',
    content: {
      es: {
        name: 'SMT con Acento Francés',
        schedule: '',
        duration: null,
        summary: 'Las huellas de la cultura francesa en la historia y la arquitectura de la ciudad.',
        description:
          'Un recorrido turístico en bus para descubrir la influencia francesa en la historia, la arquitectura y el patrimonio de San Miguel de Tucumán. Una propuesta para conocer la ciudad desde una nueva mirada.',
        highlights: [
          'Estación de Trenes Mitre',
          'Plaza Urquiza y sus alrededores',
          'Parque 9 de Julio',
          'Plaza Independencia',
        ],
      },
      en: {
        name: 'SMT with a French Accent',
        schedule: '',
        duration: null,
        summary: 'The traces of French culture in the city’s history and architecture.',
        description:
          'A bus tour to discover the French influence on the history, architecture and heritage of San Miguel de Tucumán. A fresh way to see the city through new eyes.',
        highlights: [
          'Mitre Train Station',
          'Urquiza Square and its surroundings',
          '9 de Julio Park',
          'Independencia Square',
        ],
      },
    },
  },
  {
    slug: 'pedaleando-parque',
    iconName: 'bike',
    content: {
      es: {
        name: 'Pedaleando el Parque',
        schedule: '',
        duration: null,
        summary: 'El Parque 9 de Julio en bicicleta: naturaleza, historia y arte en ocho paradas.',
        description:
          '"Pedaleando el Parque" invita a recorrer en bicicleta el Parque 9 de Julio y descubrir su patrimonio natural, histórico, artístico y cultural a través de ocho paradas interpretativas. Turismo, recreación, actividad física y movilidad sustentable en una misma propuesta. Inicio y cierre en la estatua de Diana y Endimión.',
        highlights: [
          'Lago San Miguel',
          'Palacio de los Deportes',
          'El Rosedal',
          'Casa de la Cultura',
          'Museo de la Industria Azucarera',
          'Reloj Floral y esculturas del Museo a Cielo Abierto',
        ],
      },
      en: {
        name: 'Pedaling the Park',
        schedule: '',
        duration: null,
        summary: '9 de Julio Park by bike: nature, history and art across eight stops.',
        description:
          '"Pedaling the Park" invites you to ride a bike through 9 de Julio Park and discover its natural, historic, artistic and cultural heritage across eight interpretive stops. Tourism, recreation, exercise and sustainable mobility in one experience. It starts and ends at the Diana and Endymion statue.',
        highlights: [
          'San Miguel Lake',
          'Sports Palace',
          'The Rose Garden',
          'House of Culture',
          'Sugar Industry Museum',
          'Flower Clock and Open-Air Museum sculptures',
        ],
      },
    },
  },
  {
    slug: 'gira-pianos',
    iconName: 'music',
    content: {
      es: {
        name: 'Gira Pianos · Música sobre Ruedas',
        schedule: '',
        duration: null,
        summary: 'Edificios emblemáticos con pianos históricos y música en vivo en cada parada.',
        description:
          '"Música sobre Ruedas" propone descubrir San Miguel de Tucumán recorriendo en el Bus Turístico Municipal edificios emblemáticos que conservan pianos de valor histórico y cultural. En cada parada, una breve reseña histórica del edificio y del piano, acompañada por una intervención musical de aproximadamente 15 minutos a cargo del grupo Natural Trio.',
        highlights: [
          'Teatro Alberdi',
          'Alianza Francesa',
          'El Cardón',
          'Música en vivo del Natural Trio en cada parada (~15 minutos)',
        ],
      },
      en: {
        name: 'Piano Tour · Music on Wheels',
        schedule: '',
        duration: null,
        summary: 'Landmark buildings with historic pianos and live music at every stop.',
        description:
          '"Music on Wheels" invites you to discover San Miguel de Tucumán aboard the Municipal Tourist Bus, visiting landmark buildings that preserve pianos of historic and cultural value. At each stop, a brief history of the building and its piano, followed by a live musical performance of about 15 minutes by the Natural Trio.',
        highlights: [
          'Alberdi Theater',
          'Alliance Française',
          'El Cardón',
          'Live music by the Natural Trio at every stop (~15 minutes)',
        ],
      },
    },
  },
]

// Imágenes de los heros (público turista y landing). Para sumar una nueva:
// guardarla optimizada en public/ y agregarla acá.
export const touristHeroImages = [
  '/hero-turistico-plaza.jpg',
  '/hero-turistico-casa-historica.jpg',
  '/hero-turistico-cadillal.jpg',
  '/hero-turistico-folklore.jpg',
]

export function getTouristCircuitBySlug(slug: string | null | undefined) {
  if (!slug) return null
  return touristCircuitCatalog.find((circuit) => circuit.slug === slug) || null
}

// ---------------------------------------------------------------------------
// Catálogo administrable: el contenido vive en la tabla tourist_circuits.
// El catálogo estático de arriba queda como semilla inicial y fallback.
// ---------------------------------------------------------------------------

export interface TouristCircuitRecord {
  id: number
  created_at: string
  updated_at: string
  slug: string
  icon: string
  active: boolean
  sort_order: number
  default_capacity: number | null
  default_meeting_point: string | null
  name_es: string
  schedule_es: string | null
  duration_es: string | null
  summary_es: string | null
  description_es: string | null
  highlights_es: string[]
  name_en: string | null
  schedule_en: string | null
  duration_en: string | null
  summary_en: string | null
  description_en: string | null
  highlights_en: string[]
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

// La versión en inglés cae al español campo por campo cuando falta traducción.
export function mapTouristCircuitRecord(record: TouristCircuitRecord): TouristCircuit {
  const es: TouristCircuitContent = {
    name: record.name_es,
    schedule: record.schedule_es || '',
    duration: record.duration_es || null,
    summary: record.summary_es || '',
    description: record.description_es || '',
    highlights: toStringArray(record.highlights_es),
  }
  const enHighlights = toStringArray(record.highlights_en)
  const en: TouristCircuitContent = {
    name: record.name_en || es.name,
    schedule: record.schedule_en || es.schedule,
    duration: record.duration_en || es.duration,
    summary: record.summary_en || es.summary,
    description: record.description_en || es.description,
    highlights: enHighlights.length > 0 ? enHighlights : es.highlights,
  }

  return {
    slug: record.slug,
    iconName: isTouristCircuitIcon(record.icon) ? record.icon : 'bus',
    content: { es, en },
  }
}

export function buildTouristCircuitSeedRows() {
  return touristCircuitCatalog.map((circuit, index) => ({
    slug: circuit.slug,
    icon: circuit.iconName,
    active: true,
    sort_order: (index + 1) * 10,
    default_capacity: null,
    default_meeting_point: null,
    name_es: circuit.content.es.name,
    schedule_es: circuit.content.es.schedule,
    duration_es: circuit.content.es.duration,
    summary_es: circuit.content.es.summary,
    description_es: circuit.content.es.description,
    highlights_es: circuit.content.es.highlights,
    name_en: circuit.content.en.name,
    schedule_en: circuit.content.en.schedule,
    duration_en: circuit.content.en.duration,
    summary_en: circuit.content.en.summary,
    description_en: circuit.content.en.description,
    highlights_en: circuit.content.en.highlights,
  }))
}

export function getTouristCircuitName(slug: string | null | undefined, language: TouristLanguage = 'es') {
  return getTouristCircuitBySlug(slug)?.content[language].name || null
}

export const touristOfficeInfo: Record<TouristLanguage, { title: string; address: string; hours: string[] }> = {
  es: {
    title: 'Oficina de Informes Turísticos',
    address: 'Peatonal Congreso 121, San Miguel de Tucumán',
    hours: ['Lunes a viernes: 8 a 13 h y 16 a 19 h', 'Sábados, domingos y feriados: cerrado'],
  },
  en: {
    title: 'Tourist Information Office',
    address: 'Peatonal Congreso 121, San Miguel de Tucumán',
    hours: ['Monday to Friday: 8 AM–1 PM and 4 PM–7 PM', 'Closed on Saturdays, Sundays and holidays'],
  },
}

import type { TouristBookingApiErrorCode, TouristBookingErrorCode, TouristLanguage } from '@/lib/tourist-bus'

export interface TouristPageCopy {
  brandTitle: string
  navBook: string
  navCircuits: string
  navGallery: string
  navEducational: string
  navLogin: string
  eyebrow: string
  heroTitle: string
  heroLead: string
  heroPrimaryCta: string
  heroSecondaryCta: string
  assuranceLeft: string
  assuranceRight: string
  departuresTitle: string
  departuresLead: string
  departuresEmpty: string
  departuresError: string
  departuresLoading: string
  seatsLeft: (count: number) => string
  soldOut: string
  bikesLeft: (count: number) => string
  bikesBring: string
  bikesSoldOut: string
  bikesField: string
  bikesHint: (max: number) => string
  bikesChoiceField: string
  bikesChoicePlaceholder: string
  bikesChoiceOwn: string
  bikesChoiceMunicipal: string
  bikesChoiceError: string
  meetingPointLabel: string
  bookCta: string
  moreDatesLabel: string
  moreDatesExtra: (count: number) => string
  carouselPrev: string
  carouselNext: string
  formTitle: string
  formLead: string
  circuitField: string
  circuitPlaceholder: string
  circuitRequired: string
  departureField: string
  departurePlaceholder: string
  departureSelectCircuitFirst: string
  fullNameField: string
  fullNamePlaceholder: string
  emailField: string
  phoneField: string
  originField: string
  originPlaceholder: string
  peopleField: string
  submitLabel: string
  submittingLabel: string
  successTitle: string
  successBody: (title: string, dateLabel: string) => string
  successEmailNote: string
  circuitsTitle: string
  circuitsLead: string
  scheduleLabel: string
  durationLabel: string
  highlightsLabel: string
  detailsShow: string
  detailsHide: string
  galleryTitle: string
  galleryLead: string
  galleryCount: (count: number) => string
  galleryOpen: string
  galleryAll: string
  officeNote: string
  backToHome: string
  freeLabel: string
  fieldErrors: Record<TouristBookingErrorCode, string>
  apiErrors: Record<TouristBookingApiErrorCode, string>
}

export const touristPageCopy: Record<TouristLanguage, TouristPageCopy> = {
  es: {
    brandTitle: 'Bus Turístico',
    navBook: 'Reservar lugar',
    navCircuits: 'Circuitos',
    navGallery: 'Galería',
    navEducational: 'Bus educativo',
    navLogin: 'Iniciar sesión',
    eyebrow: 'Turismo municipal',
    heroTitle: 'Descubrí San Miguel de Tucumán desde cada rincón',
    heroLead:
      'Recorridos guiados que conectan cultura, patrimonio y experiencias únicas para vecinos y visitantes. Elegí una salida programada y reservá tu lugar.',
    heroPrimaryCta: 'Reservar lugar',
    heroSecondaryCta: 'Ver circuitos',
    assuranceLeft: 'Servicio turístico municipal',
    assuranceRight: 'Salidas programadas con cupos limitados',
    departuresTitle: 'Próximas salidas',
    departuresLead: 'Estas son las salidas con inscripción abierta. Los cupos se actualizan en tiempo real.',
    departuresEmpty: 'Por el momento no hay salidas con inscripción abierta. Volvé a consultar pronto.',
    departuresError: 'No pudimos cargar las salidas. Intentá de nuevo en unos minutos.',
    departuresLoading: 'Cargando salidas disponibles…',
    seatsLeft: (count) => (count === 1 ? 'Queda 1 lugar' : `Quedan ${count} lugares`),
    soldOut: 'Sin cupo',
    bikesLeft: (count) => (count === 1 ? '🚲 Queda 1 bici municipal' : `🚲 Quedan ${count} bicis municipales`),
    bikesBring: 'o traé tu propia bici',
    bikesSoldOut: '🚲 Bicis municipales agotadas: podés participar con la tuya',
    bikesField: '¿Cuántas bicicletas municipales necesitan?',
    bikesHint: (max) => `Hay ${max} disponibles para esta salida.`,
    bikesChoiceField: '¿Traen bicicletas propias?',
    bikesChoicePlaceholder: 'Elegí una opción',
    bikesChoiceOwn: 'Sí, llevamos bicicletas propias',
    bikesChoiceMunicipal: 'No, necesitamos bicicletas municipales',
    bikesChoiceError: 'Contanos si traen bicis propias o necesitan municipales.',
    meetingPointLabel: 'Punto de encuentro',
    bookCta: 'Reservar',
    moreDatesLabel: 'Más fechas',
    moreDatesExtra: (count) => `+${count} más`,
    carouselPrev: 'Circuitos anteriores',
    carouselNext: 'Más circuitos',
    formTitle: 'Reservá tu lugar',
    formLead: 'Completá tus datos y confirmá al instante. La reserva es gratuita.',
    circuitField: 'Circuito',
    circuitPlaceholder: 'Elegí un circuito',
    circuitRequired: 'Elegí un circuito.',
    departureField: 'Salida',
    departurePlaceholder: 'Elegí fecha y horario',
    departureSelectCircuitFirst: 'Primero elegí un circuito',
    fullNameField: 'Nombre y apellido',
    fullNamePlaceholder: 'Ej: Ana Pérez',
    emailField: 'Correo electrónico',
    phoneField: 'Teléfono',
    originField: 'Ciudad de procedencia (opcional)',
    originPlaceholder: 'Ej: Salta, Argentina',
    peopleField: 'Cantidad de personas',
    submitLabel: 'Confirmar reserva',
    submittingLabel: 'Enviando…',
    successTitle: '¡Reserva confirmada!',
    successBody: (title, dateLabel) =>
      `Tu lugar para "${title}" (${dateLabel}) quedó confirmado. Presentate 30 minutos antes de la salida.`,
    successEmailNote: 'Te enviamos un correo con los detalles de tu reserva.',
    circuitsTitle: 'Nuestros circuitos',
    circuitsLead:
      'Una propuesta integral para descubrir la ciudad desde su historia, su arte y su gente. Las salidas disponibles de cada circuito se publican en la sección de arriba.',
    scheduleLabel: 'Días y horarios',
    durationLabel: 'Duración',
    highlightsLabel: 'Qué incluye el recorrido',
    detailsShow: 'Ver detalle',
    detailsHide: 'Ocultar detalle',
    galleryTitle: 'Fotos de los recorridos',
    galleryLead: 'Buscá las fotos del día en que hiciste tu recorrido. Quedan disponibles durante 7 días.',
    galleryCount: (count) => (count === 1 ? '1 foto' : `${count} fotos`),
    galleryOpen: 'Ver fotos',
    galleryAll: 'Ver todas las galerías',
    officeNote: 'También podés reservar personalmente en la oficina de informes.',
    backToHome: 'Volver al inicio',
    freeLabel: 'Gratuito',
    fieldErrors: {
      departure_required: 'Elegí una salida disponible.',
      full_name_required: 'Ingresá tu nombre y apellido.',
      email_required: 'Ingresá un correo electrónico.',
      email_invalid: 'Ingresá un correo electrónico válido.',
      phone_required: 'Ingresá un teléfono de contacto.',
      phone_invalid: 'Ingresá un teléfono válido.',
      people_required: 'Indicá cuántas personas asisten.',
      people_invalid: 'La cantidad de personas no es válida.',
      bikes_invalid: 'La cantidad de bicis no es válida (no puede superar a las personas).',
    },
    apiErrors: {
      NOT_FOUND: 'La salida elegida ya no está disponible.',
      CANCELLED: 'Esa salida fue cancelada. Elegí otra fecha.',
      PAST: 'Esa salida ya pasó. Elegí otra fecha.',
      NO_CAPACITY: 'No quedan cupos suficientes para esa salida.',
      NO_BIKES: 'No quedan tantas bicis municipales para esa salida. Podés reservar con bici propia.',
      INVALID_BIKES: 'La cantidad de bicicletas no es válida.',
      INVALID_PEOPLE_COUNT: 'La cantidad de personas no es válida.',
      VALIDATION: 'Revisá los campos marcados.',
      SERVER: 'No pudimos registrar la reserva. Intentá de nuevo en unos minutos.',
    },
  },
  en: {
    brandTitle: 'Tourist Bus',
    navBook: 'Book a seat',
    navCircuits: 'Circuits',
    navGallery: 'Gallery',
    navEducational: 'Educational bus',
    navLogin: 'Log in',
    eyebrow: 'Municipal tourism',
    heroTitle: 'Discover San Miguel de Tucumán from every corner',
    heroLead:
      'Guided tours connecting culture, heritage and unique experiences for locals and visitors. Pick a scheduled departure and book your seat.',
    heroPrimaryCta: 'Book a seat',
    heroSecondaryCta: 'See circuits',
    assuranceLeft: 'Municipal tourism service',
    assuranceRight: 'Scheduled departures with limited seats',
    departuresTitle: 'Upcoming departures',
    departuresLead: 'These departures are open for registration. Seats update in real time.',
    departuresEmpty: 'There are no departures open for registration right now. Check back soon.',
    departuresError: 'We couldn’t load the departures. Please try again in a few minutes.',
    departuresLoading: 'Loading available departures…',
    seatsLeft: (count) => (count === 1 ? '1 seat left' : `${count} seats left`),
    soldOut: 'Sold out',
    bikesLeft: (count) => (count === 1 ? '🚲 1 municipal bike left' : `🚲 ${count} municipal bikes left`),
    bikesBring: 'or bring your own bike',
    bikesSoldOut: '🚲 Municipal bikes are gone: you can join with your own',
    bikesField: 'How many municipal bikes do you need?',
    bikesHint: (max) => `${max} available for this departure.`,
    bikesChoiceField: 'Are you bringing your own bikes?',
    bikesChoicePlaceholder: 'Choose an option',
    bikesChoiceOwn: 'Yes, we bring our own bikes',
    bikesChoiceMunicipal: 'No, we need municipal bikes',
    bikesChoiceError: 'Tell us if you bring your own bikes or need municipal ones.',
    meetingPointLabel: 'Meeting point',
    bookCta: 'Book',
    moreDatesLabel: 'More dates',
    moreDatesExtra: (count) => `+${count} more`,
    carouselPrev: 'Previous circuits',
    carouselNext: 'More circuits',
    formTitle: 'Book your seat',
    formLead: 'Fill in your details and get instant confirmation. Booking is free.',
    circuitField: 'Circuit',
    circuitPlaceholder: 'Choose a circuit',
    circuitRequired: 'Choose a circuit.',
    departureField: 'Departure',
    departurePlaceholder: 'Choose date and time',
    departureSelectCircuitFirst: 'First choose a circuit',
    fullNameField: 'Full name',
    fullNamePlaceholder: 'E.g. Jane Smith',
    emailField: 'Email',
    phoneField: 'Phone',
    originField: 'City of origin (optional)',
    originPlaceholder: 'E.g. Santiago, Chile',
    peopleField: 'Number of people',
    submitLabel: 'Confirm booking',
    submittingLabel: 'Sending…',
    successTitle: 'Booking confirmed!',
    successBody: (title, dateLabel) =>
      `Your seat for "${title}" (${dateLabel}) is confirmed. Please arrive 30 minutes before departure.`,
    successEmailNote: 'We sent you an email with your booking details.',
    circuitsTitle: 'Our circuits',
    circuitsLead:
      'A complete way to discover the city through its history, art and people. Available departures for each circuit are published in the section above.',
    scheduleLabel: 'Days and times',
    durationLabel: 'Duration',
    highlightsLabel: 'Tour highlights',
    detailsShow: 'See details',
    detailsHide: 'Hide details',
    galleryTitle: 'Tour photos',
    galleryLead: 'Find the photos from the day of your tour. They stay available for 7 days.',
    galleryCount: (count) => (count === 1 ? '1 photo' : `${count} photos`),
    galleryOpen: 'View photos',
    galleryAll: 'See all galleries',
    officeNote: 'You can also book in person at the tourist information office.',
    backToHome: 'Back to home',
    freeLabel: 'Free',
    fieldErrors: {
      departure_required: 'Choose an available departure.',
      full_name_required: 'Enter your full name.',
      email_required: 'Enter an email address.',
      email_invalid: 'Enter a valid email address.',
      phone_required: 'Enter a contact phone number.',
      phone_invalid: 'Enter a valid phone number.',
      people_required: 'Tell us how many people are coming.',
      people_invalid: 'The number of people is not valid.',
      bikes_invalid: 'The number of bikes is not valid (it can’t exceed the number of people).',
    },
    apiErrors: {
      NOT_FOUND: 'The selected departure is no longer available.',
      CANCELLED: 'That departure was cancelled. Please pick another date.',
      PAST: 'That departure already took place. Please pick another date.',
      NO_CAPACITY: 'There aren’t enough seats left for that departure.',
      NO_BIKES: 'There aren’t that many municipal bikes left for that departure. You can book with your own bike.',
      INVALID_BIKES: 'The number of bikes is not valid.',
      INVALID_PEOPLE_COUNT: 'The number of people is not valid.',
      VALIDATION: 'Please review the highlighted fields.',
      SERVER: 'We couldn’t register your booking. Please try again in a few minutes.',
    },
  },
}

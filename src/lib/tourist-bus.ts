import { isValidPhone, parseBusinessDateParts } from '@/lib/educational-bus-requests'

export type TouristLanguage = 'es' | 'en'
export type TouristDepartureStatus = 'active' | 'cancelled'
export type TouristBookingStatus = 'confirmed' | 'cancelled'

export interface TouristDeparture {
  id: number
  created_at: string
  updated_at: string
  circuit_slug: string | null
  title: string
  departure_date: string
  departure_time: string
  capacity: number
  meeting_point: string | null
  notes: string | null
  status: TouristDepartureStatus
}

export interface TouristDepartureAvailability extends TouristDeparture {
  reserved: number
  remaining: number
}

export interface TouristBooking {
  id: number
  created_at: string
  updated_at: string
  departure_id: number
  full_name: string
  email: string
  phone: string
  origin_city: string | null
  people_count: number
  language: TouristLanguage
  status: TouristBookingStatus
}

export interface TouristBookingFormData {
  departureId: string
  fullName: string
  email: string
  phone: string
  originCity: string
  peopleCount: string
}

export type TouristBookingErrorCode =
  | 'departure_required'
  | 'full_name_required'
  | 'email_required'
  | 'email_invalid'
  | 'phone_required'
  | 'phone_invalid'
  | 'people_required'
  | 'people_invalid'

export type TouristBookingFormErrors = Partial<Record<keyof TouristBookingFormData, TouristBookingErrorCode>>

export type TouristBookingApiErrorCode =
  | 'NOT_FOUND'
  | 'CANCELLED'
  | 'PAST'
  | 'NO_CAPACITY'
  | 'INVALID_PEOPLE_COUNT'
  | 'VALIDATION'
  | 'SERVER'

export const maximumPeoplePerBooking = 20

export const initialTouristBookingFormData: TouristBookingFormData = {
  departureId: '',
  fullName: '',
  email: '',
  phone: '',
  originCity: '',
  peopleCount: '1',
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidPeopleCount(value: string | number) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numberValue) && numberValue >= 1 && numberValue <= maximumPeoplePerBooking
}

export function validateTouristBookingForm(data: TouristBookingFormData): TouristBookingFormErrors {
  const errors: TouristBookingFormErrors = {}

  if (!data.departureId.trim() || !Number.isInteger(Number(data.departureId))) {
    errors.departureId = 'departure_required'
  }
  if (!data.fullName.trim()) {
    errors.fullName = 'full_name_required'
  }
  if (!data.email.trim()) {
    errors.email = 'email_required'
  } else if (!emailRegex.test(data.email)) {
    errors.email = 'email_invalid'
  }
  if (!data.phone.trim()) {
    errors.phone = 'phone_required'
  } else if (!isValidPhone(data.phone)) {
    errors.phone = 'phone_invalid'
  }
  if (!data.peopleCount.trim()) {
    errors.peopleCount = 'people_required'
  } else if (!isValidPeopleCount(data.peopleCount)) {
    errors.peopleCount = 'people_invalid'
  }

  return errors
}

export function toTouristBookingRpcParams(data: TouristBookingFormData, language: TouristLanguage) {
  return {
    p_departure_id: Number(data.departureId),
    p_full_name: data.fullName.trim(),
    p_email: data.email.trim().toLowerCase(),
    p_phone: data.phone.trim(),
    p_origin_city: data.originCity.trim() || null,
    p_people_count: Number(data.peopleCount),
    p_language: language,
  }
}

export function formatDepartureTime(time: string) {
  const match = /^(\d{2}):(\d{2})/.exec(time || '')
  if (!match) return time
  return `${match[1]}:${match[2]}`
}

const departureDateFormatters: Record<TouristLanguage, Intl.DateTimeFormat> = {
  es: new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
  en: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
}

export function formatDepartureDate(dateKey: string, language: TouristLanguage) {
  const parts = parseBusinessDateParts(dateKey)
  if (!parts) return dateKey
  const formatted = departureDateFormatters[language].format(new Date(parts.year, parts.month - 1, parts.day))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

const shortDepartureDateFormatters: Record<TouristLanguage, Intl.DateTimeFormat> = {
  es: new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
  en: new Intl.DateTimeFormat('en-US', { weekday: 'short', month: '2-digit', day: '2-digit' }),
}

// Versión corta para chips: "Sáb 22/08".
export function formatDepartureDateShort(dateKey: string, language: TouristLanguage) {
  const parts = parseBusinessDateParts(dateKey)
  if (!parts) return dateKey
  const formatted = shortDepartureDateFormatters[language]
    .format(new Date(parts.year, parts.month - 1, parts.day))
    .replace(',', '')
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function getDepartureOccupancyPercent(departure: Pick<TouristDepartureAvailability, 'capacity' | 'reserved'>) {
  if (departure.capacity <= 0) return 100
  return Math.min(100, Math.round((departure.reserved / departure.capacity) * 100))
}

export function buildDeparturesWithAvailability(
  departures: TouristDeparture[],
  bookings: Array<Pick<TouristBooking, 'departure_id' | 'people_count'>>,
): TouristDepartureAvailability[] {
  const reservedByDeparture = bookings.reduce<Record<number, number>>((acc, booking) => {
    acc[booking.departure_id] = (acc[booking.departure_id] || 0) + booking.people_count
    return acc
  }, {})

  return departures.map((departure) => {
    const reserved = reservedByDeparture[departure.id] || 0
    return {
      ...departure,
      reserved,
      remaining: Math.max(departure.capacity - reserved, 0),
    }
  })
}

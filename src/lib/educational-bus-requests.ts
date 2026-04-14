export const institutionTypeOptions = [
  { value: 'municipal', label: 'Escuela municipal' },
  { value: 'provincial', label: 'Escuela provincial' },
  { value: 'private', label: 'Institución privada' },
] as const

export const preferredShiftOptions = [
  { value: 'manana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
] as const

export const requestStatusOptions = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'rejected', label: 'Rechazada' },
] as const

export type EducationalInstitutionType = (typeof institutionTypeOptions)[number]['value']
export type PreferredShift = (typeof preferredShiftOptions)[number]['value']
export type EducationalBusRequestStatus = (typeof requestStatusOptions)[number]['value']

export interface EducationalBusRequestFormData {
  institutionName: string
  schoolAddress: string
  contactName: string
  contactRole: string
  contactPhone: string
  contactEmail: string
  studentCount: string
  gradeYear: string
  requestedDate: string
  preferredShift: PreferredShift | ''
  institutionType: EducationalInstitutionType | ''
  additionalNotes: string
}

export interface EducationalBusRequestPayload {
  institution_name: string
  school_address: string
  contact_name: string
  contact_role: string
  contact_phone: string
  contact_email: string
  student_count: number
  grade_year: string
  requested_date: string
  preferred_shift: PreferredShift
  institution_type: EducationalInstitutionType
  additional_notes: string | null
}

export interface EducationalBusRequest extends EducationalBusRequestPayload {
  id: number
  created_at: string
  updated_at: string
  status: EducationalBusRequestStatus
  internal_notes: string | null
}

export interface EducationalBusRequestFilters {
  search?: string
  status?: EducationalBusRequestStatus | ''
  preferredShift?: PreferredShift | ''
  institutionType?: EducationalInstitutionType | ''
  requestedDate?: string
}

export type EducationalBusRequestFormErrors = Partial<Record<keyof EducationalBusRequestFormData, string>>

export const contactRoleOptions = [
  'Director/a',
  'Vicedirector/a',
  'Docente',
  'Coordinador/a',
  'Secretario/a',
  'Preceptor/a',
  'Otro',
] as const

export const initialEducationalBusRequestFormData: EducationalBusRequestFormData = {
  institutionName: '',
  schoolAddress: '',
  contactName: '',
  contactRole: '',
  contactPhone: '',
  contactEmail: '',
  studentCount: '',
  gradeYear: '',
  requestedDate: '',
  preferredShift: '',
  institutionType: '',
  additionalNotes: '',
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const buenosAiresDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function buildDateKey(year: number, month: number, day: number) {
  return `${year}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`
}

export function parseBusinessDateParts(dateString: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null

  return { year, month, day }
}

export function getTodayDateStringInBuenosAires() {
  return buenosAiresDateFormatter.format(new Date())
}

export function getTodayDateString() {
  return getTodayDateStringInBuenosAires()
}

export function isPastBusinessDate(dateString: string) {
  const parts = parseBusinessDateParts(dateString)
  if (!parts) return false
  return buildDateKey(parts.year, parts.month, parts.day) < getTodayDateStringInBuenosAires()
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getDayOfWeekMondayFirst(year: number, month: number, day: number) {
  return (new Date(year, month - 1, day).getDay() + 6) % 7
}

function shiftDateParts(year: number, month: number, day: number, offset: number) {
  const shifted = new Date(year, month - 1, day + offset)
  return {
    year: shifted.getFullYear(),
    month: shifted.getMonth() + 1,
    day: shifted.getDate(),
  }
}

export function getMonthCalendarMatrix(currentMonthKey: string) {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(currentMonthKey)
  if (!monthMatch) return []

  const year = Number(monthMatch[1])
  const month = Number(monthMatch[2])
  const daysInMonth = getDaysInMonth(year, month)
  const firstWeekday = getDayOfWeekMondayFirst(year, month, 1)
  const matrix: Array<Array<{ dateKey: string; dayNumber: number; isCurrentMonth: boolean }>> = []
  let offset = -firstWeekday

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const week: Array<{ dateKey: string; dayNumber: number; isCurrentMonth: boolean }> = []

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const targetDay = 1 + offset
      let cellYear = year
      let cellMonth = month
      let cellDay = targetDay
      let isCurrentMonth = true

      if (targetDay < 1) {
        const previous = shiftDateParts(year, month, 1, offset)
        cellYear = previous.year
        cellMonth = previous.month
        cellDay = previous.day
        isCurrentMonth = false
      } else if (targetDay > daysInMonth) {
        const next = shiftDateParts(year, month, daysInMonth, targetDay - daysInMonth)
        cellYear = next.year
        cellMonth = next.month
        cellDay = next.day
        isCurrentMonth = false
      }

      week.push({
        dateKey: buildDateKey(cellYear, cellMonth, cellDay),
        dayNumber: cellDay,
        isCurrentMonth,
      })

      offset += 1
    }

    matrix.push(week)
  }

  return matrix
}

export function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

export function validateEducationalBusRequestForm(data: EducationalBusRequestFormData): EducationalBusRequestFormErrors {
  const errors: EducationalBusRequestFormErrors = {}

  if (!data.institutionName.trim()) errors.institutionName = 'Ingresa el nombre de la institución.'
  if (!data.schoolAddress.trim()) errors.schoolAddress = 'Ingresa la dirección de la escuela.'
  if (!data.contactName.trim()) errors.contactName = 'Ingresa el nombre y apellido del responsable.'
  if (!data.contactRole.trim()) errors.contactRole = 'Selecciona o escribe el cargo del responsable.'
  if (!data.contactPhone.trim()) {
    errors.contactPhone = 'Ingresa un teléfono de contacto.'
  } else if (!isValidPhone(data.contactPhone)) {
    errors.contactPhone = 'Ingresa un teléfono válido.'
  }
  if (!data.contactEmail.trim()) {
    errors.contactEmail = 'Ingresa un email de contacto.'
  } else if (!emailRegex.test(data.contactEmail)) {
    errors.contactEmail = 'Ingresa un email válido.'
  }
  if (!data.studentCount.trim()) {
    errors.studentCount = 'Ingresa la cantidad de alumnos.'
  } else if (!Number.isInteger(Number(data.studentCount)) || Number(data.studentCount) <= 0) {
    errors.studentCount = 'Ingresa una cantidad válida de alumnos.'
  }
  if (!data.gradeYear.trim()) errors.gradeYear = 'Ingresa el grado o año.'
  if (!data.requestedDate) {
    errors.requestedDate = 'Selecciona una fecha para el turno.'
  } else if (!parseBusinessDateParts(data.requestedDate)) {
    errors.requestedDate = 'Ingresa una fecha válida.'
  } else if (isPastBusinessDate(data.requestedDate)) {
    errors.requestedDate = 'No se permiten fechas pasadas.'
  }
  if (!data.preferredShift) errors.preferredShift = 'Selecciona el turno preferido.'
  if (!data.institutionType) errors.institutionType = 'Selecciona el tipo de institución.'

  return errors
}

export function toEducationalBusRequestPayload(data: EducationalBusRequestFormData): EducationalBusRequestPayload {
  return {
    institution_name: data.institutionName.trim(),
    school_address: data.schoolAddress.trim(),
    contact_name: data.contactName.trim(),
    contact_role: data.contactRole.trim(),
    contact_phone: data.contactPhone.trim(),
    contact_email: data.contactEmail.trim().toLowerCase(),
    student_count: Number(data.studentCount),
    grade_year: data.gradeYear.trim(),
    requested_date: data.requestedDate,
    preferred_shift: data.preferredShift as PreferredShift,
    institution_type: data.institutionType as EducationalInstitutionType,
    additional_notes: data.additionalNotes.trim() ? data.additionalNotes.trim() : null,
  }
}

export function getRequestStatusLabel(status: EducationalBusRequestStatus) {
  return requestStatusOptions.find((option) => option.value === status)?.label || status
}

export function getInstitutionTypeLabel(type: EducationalInstitutionType) {
  return institutionTypeOptions.find((option) => option.value === type)?.label || type
}

export function getShiftLabel(shift: PreferredShift) {
  return preferredShiftOptions.find((option) => option.value === shift)?.label || shift
}

export function formatDateToDisplay(dateString: string) {
  if (!dateString) return ''
  const [year, month, day] = dateString.slice(0, 10).split('-')
  if (!year || !month || !day) return dateString
  return `${day}-${month}-${year}`
}

export function formatDateTimeToDisplay(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString

  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const hour = parts.find((part) => part.type === 'hour')?.value ?? ''
  const minute = parts.find((part) => part.type === 'minute')?.value ?? ''

  if (!day || !month || !year || !hour || !minute) return dateString
  return `${day}-${month}-${year} ${hour}:${minute}`
}

export function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Buenos_Aires',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

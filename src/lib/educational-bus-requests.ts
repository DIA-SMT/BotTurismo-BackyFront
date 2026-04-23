export const institutionTypeOptions = [
  { value: 'municipal', label: 'Escuela municipal' },
  { value: 'provincial', label: 'Escuela provincial' },
  { value: 'private', label: 'Institución privada' },
] as const

export const preferredShiftOptions = [
  { value: 'manana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
] as const

export const circuitOptions = [
  { value: 'historico_cultural', label: 'Histórico Cultural' },
  { value: 'memoria', label: 'Memoria' },
] as const

export const requestStatusOptions = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'rejected', label: 'Rechazada' },
] as const

export type EducationalInstitutionType = (typeof institutionTypeOptions)[number]['value']
export type PreferredShift = (typeof preferredShiftOptions)[number]['value']
export type EducationalBusCircuit = (typeof circuitOptions)[number]['value']
export type EducationalBusRequestStatus = (typeof requestStatusOptions)[number]['value']
export type BusinessWeekday = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
export type PublicAvailabilityShiftStatus = 'available' | 'occupied' | 'disabled' | 'past'

export const minimumStudentCount = 15
export const maximumStudentCount = 44

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
  circuit: EducationalBusCircuit | ''
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
  circuit: EducationalBusCircuit
  additional_notes: string | null
  attachment_name: string
  attachment_path: string
}

export interface EducationalBusRequest extends EducationalBusRequestPayload {
  id: number
  created_at: string
  updated_at: string
  status: EducationalBusRequestStatus
  internal_notes: string | null
  guides: string | null
}

export interface EducationalBusRequestFilters {
  search?: string
  status?: EducationalBusRequestStatus | ''
  preferredShift?: PreferredShift | ''
  institutionType?: EducationalInstitutionType | ''
  requestedDate?: string
}

export type EducationalBusRequestFormErrors = Partial<Record<keyof EducationalBusRequestFormData | 'attachment', string>>

export interface PublicAvailabilityShift {
  shift: PreferredShift
  status: PublicAvailabilityShiftStatus
}

export interface PublicAvailabilityDay {
  dateKey: string
  weekday: BusinessWeekday | null
  isPast: boolean
  isCircuitDay: boolean
  allowedShifts: PreferredShift[]
  occupiedShifts: PreferredShift[]
  availableShifts: PreferredShift[]
  shifts: PublicAvailabilityShift[]
}

export interface PublicAvailabilityResponse {
  circuit: EducationalBusCircuit
  month: string
  days: PublicAvailabilityDay[]
}

export const contactRoleOptions = [
  'Director/a',
  'Vicedirector/a',
  'Docente',
  'Coordinador/a',
  'Secretario/a',
  'Preceptor/a',
  'Otro',
] as const

export const gradeYearOptions = [
  { value: 'primer_grado_primaria', label: '1° grado de primaria' },
  { value: 'segundo_grado_primaria', label: '2° grado de primaria' },
  { value: 'tercer_grado_primaria', label: '3° grado de primaria' },
  { value: 'cuarto_grado_primaria', label: '4° grado de primaria' },
  { value: 'quinto_grado_primaria', label: '5° grado de primaria' },
  { value: 'sexto_grado_primaria', label: '6° grado de primaria' },
  { value: 'septimo_grado_primaria', label: '7° grado de primaria' },
  { value: 'primer_ano_secundaria', label: '1° año de secundaria' },
  { value: 'segundo_ano_secundaria', label: '2° año de secundaria' },
  { value: 'tercer_ano_secundaria', label: '3° año de secundaria' },
  { value: 'cuarto_ano_secundaria', label: '4° año de secundaria' },
  { value: 'quinto_ano_secundaria', label: '5° año de secundaria' },
  { value: 'sexto_ano_secundaria', label: '6° año de secundaria' },
] as const

export const advancedSecondaryGradeValues = new Set<string>([
  'cuarto_ano_secundaria',
  'quinto_ano_secundaria',
  'sexto_ano_secundaria',
])

export const weekdayLabels: Record<BusinessWeekday, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
}

export const circuitAvailability: Record<EducationalBusCircuit, Partial<Record<BusinessWeekday, PreferredShift[]>>> = {
  historico_cultural: {
    martes: ['manana', 'tarde'],
    miercoles: ['manana', 'tarde'],
    jueves: ['tarde'],
    viernes: ['manana'],
  },
  memoria: {
    jueves: ['manana'],
  },
}

export const educationalBusAttachmentBucket = 'educational-bus-request-files'
export const educationalBusTemplatePublicPath = '/nota_modelo_bus_turistico.docx'
export const educationalBusTemplateLabel = 'Descargar nota modelo (.docx)'
export const acceptedEducationalBusAttachmentExtensions = ['.docx']
export const acceptedEducationalBusAttachmentMimeTypes = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]
export const educationalBusAttachmentMaxSizeBytes = 10 * 1024 * 1024

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
  circuit: '',
  additionalNotes: '',
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const buenosAiresDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const dateTimeDisplayFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
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

export function getMonthBounds(monthKey: string) {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthKey)
  if (!monthMatch) return null

  const year = Number(monthMatch[1])
  const month = Number(monthMatch[2])
  if (!year || month < 1 || month > 12) return null

  const lastDay = getDaysInMonth(year, month)
  return {
    year,
    month,
    startDate: buildDateKey(year, month, 1),
    endDate: buildDateKey(year, month, lastDay),
  }
}

export function getBusinessWeekday(dateString: string): BusinessWeekday | null {
  const parts = parseBusinessDateParts(dateString)
  if (!parts) return null

  const dayIndex = new Date(parts.year, parts.month - 1, parts.day).getDay()
  const days: BusinessWeekday[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  return days[dayIndex] ?? null
}

export function getAvailableWeekdaysForCircuit(circuit: EducationalBusCircuit | '') {
  if (!circuit) return [] as BusinessWeekday[]
  return Object.keys(circuitAvailability[circuit]) as BusinessWeekday[]
}

export function getAvailableShiftsForCircuitAndDate(circuit: EducationalBusCircuit | '', requestedDate: string) {
  if (!circuit || !requestedDate) return [] as PreferredShift[]
  const weekday = getBusinessWeekday(requestedDate)
  if (!weekday) return [] as PreferredShift[]
  return circuitAvailability[circuit][weekday] ?? []
}

export function isAllowedAdvancedSecondaryGrade(gradeYear: string) {
  return advancedSecondaryGradeValues.has(gradeYear)
}

export function isValidStudentCount(value: string | number) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numberValue) && numberValue >= minimumStudentCount && numberValue <= maximumStudentCount
}

export function isCircuitDateAllowed(circuit: EducationalBusCircuit | '', requestedDate: string) {
  if (!circuit || !requestedDate) return false
  return getAvailableShiftsForCircuitAndDate(circuit, requestedDate).length > 0
}

export function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

export function buildMonthlyAvailability(
  circuit: EducationalBusCircuit,
  monthKey: string,
  occupiedByDate: Record<string, PreferredShift[]>,
): PublicAvailabilityResponse | null {
  const bounds = getMonthBounds(monthKey)
  if (!bounds) return null

  const days: PublicAvailabilityDay[] = []

  for (let day = 1; day <= getDaysInMonth(bounds.year, bounds.month); day += 1) {
    const dateKey = buildDateKey(bounds.year, bounds.month, day)
    const weekday = getBusinessWeekday(dateKey)
    const allowedShifts = weekday ? circuitAvailability[circuit][weekday] ?? [] : []
    const occupiedShifts = occupiedByDate[dateKey] || []
    const isPast = isPastBusinessDate(dateKey)
    const isCircuitDay = allowedShifts.length > 0
    const availableShifts = allowedShifts.filter((shift) => !isPast && !occupiedShifts.includes(shift))

    days.push({
      dateKey,
      weekday,
      isPast,
      isCircuitDay,
      allowedShifts,
      occupiedShifts,
      availableShifts,
      shifts: preferredShiftOptions.map((option) => {
        let status: PublicAvailabilityShiftStatus = 'available'
        if (!allowedShifts.includes(option.value)) status = 'disabled'
        else if (isPast) status = 'past'
        else if (occupiedShifts.includes(option.value)) status = 'occupied'
        return { shift: option.value, status }
      }),
    })
  }

  return {
    circuit,
    month: monthKey,
    days,
  }
}

export function validateEducationalBusAttachment(file: File | null) {
  if (!file) return 'Adjunta la nota modelo completa en formato .docx.'
  if (!file.name.toLowerCase().endsWith('.docx')) return 'El archivo adjunto debe estar en formato .docx.'
  if (file.size <= 0) return 'El archivo adjunto está vacío.'
  if (file.size > educationalBusAttachmentMaxSizeBytes) return 'El archivo adjunto supera el tamaño máximo permitido de 10 MB.'
  if (file.type && !acceptedEducationalBusAttachmentMimeTypes.includes(file.type)) {
    return 'El archivo adjunto debe ser un documento .docx válido.'
  }
  return null
}

export function validateEducationalBusRequestForm(data: EducationalBusRequestFormData): EducationalBusRequestFormErrors {
  const errors: EducationalBusRequestFormErrors = {}

  if (!data.circuit) {
    errors.circuit = 'Selecciona un circuito.'
  }
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
  } else if (!isValidStudentCount(data.studentCount)) {
    errors.studentCount = `La cantidad de alumnos debe ser entre ${minimumStudentCount} y ${maximumStudentCount}.`
  }
  if (!data.gradeYear) {
    errors.gradeYear = 'Selecciona el grado o año.'
  }
  if (!data.requestedDate) {
    errors.requestedDate = 'Selecciona una fecha para el turno.'
  } else if (!parseBusinessDateParts(data.requestedDate)) {
    errors.requestedDate = 'Ingresa una fecha válida.'
  } else if (isPastBusinessDate(data.requestedDate)) {
    errors.requestedDate = 'No se permiten fechas pasadas.'
  } else if (data.circuit && !isCircuitDateAllowed(data.circuit, data.requestedDate)) {
    errors.requestedDate = 'La fecha elegida no está disponible para el circuito seleccionado.'
  }
  if (!data.preferredShift) {
    errors.preferredShift = 'Selecciona el turno preferido.'
  } else if (data.circuit && data.requestedDate) {
    const allowedShifts = getAvailableShiftsForCircuitAndDate(data.circuit, data.requestedDate)
    if (!allowedShifts.includes(data.preferredShift)) {
      errors.preferredShift = 'El turno elegido no está disponible para el circuito y la fecha seleccionados.'
    }
  }
  if (!data.institutionType) errors.institutionType = 'Selecciona el tipo de institución.'

  if (data.circuit === 'memoria' && data.gradeYear && !isAllowedAdvancedSecondaryGrade(data.gradeYear)) {
    errors.gradeYear = 'El circuito Memoria está disponible únicamente para los últimos 3 años del nivel secundario.'
  }

  return errors
}

export function toEducationalBusRequestPayload(
  data: EducationalBusRequestFormData,
  attachment: { attachmentName: string; attachmentPath: string },
): EducationalBusRequestPayload {
  return {
    institution_name: data.institutionName.trim(),
    school_address: data.schoolAddress.trim(),
    contact_name: data.contactName.trim(),
    contact_role: data.contactRole.trim(),
    contact_phone: data.contactPhone.trim(),
    contact_email: data.contactEmail.trim().toLowerCase(),
    student_count: Number(data.studentCount),
    grade_year: data.gradeYear,
    requested_date: data.requestedDate,
    preferred_shift: data.preferredShift as PreferredShift,
    institution_type: data.institutionType as EducationalInstitutionType,
    circuit: data.circuit as EducationalBusCircuit,
    additional_notes: data.additionalNotes.trim() ? data.additionalNotes.trim() : null,
    attachment_name: attachment.attachmentName,
    attachment_path: attachment.attachmentPath,
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

export function getCircuitLabel(circuit: EducationalBusCircuit) {
  return circuitOptions.find((option) => option.value === circuit)?.label || circuit
}

export function getGradeYearLabel(gradeYear: string) {
  return gradeYearOptions.find((option) => option.value === gradeYear)?.label || gradeYear
}

export function getEducationalLevelLabel(gradeYear: string) {
  if (gradeYear.includes('primaria')) return 'Primario'
  if (gradeYear.includes('secundaria')) return 'Secundario'
  return getGradeYearLabel(gradeYear)
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

  const parts = dateTimeDisplayFormatter.formatToParts(date)
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

export function formatEducationalBusExportSlot(dateString: string, shift: PreferredShift) {
  return `${formatDateToDisplay(dateString)} turno ${getShiftLabel(shift).toLowerCase()}`
}

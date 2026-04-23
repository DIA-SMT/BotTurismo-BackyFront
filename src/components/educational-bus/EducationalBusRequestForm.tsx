'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  acceptedEducationalBusAttachmentExtensions,
  circuitOptions,
  contactRoleOptions,
  educationalBusTemplateLabel,
  educationalBusTemplatePublicPath,
  formatDateToDisplay,
  getAvailableWeekdaysForCircuit,
  getCircuitLabel,
  getGradeYearLabel,
  getTodayDateStringInBuenosAires,
  getBusinessWeekday,
  gradeYearOptions,
  initialEducationalBusRequestFormData,
  institutionTypeOptions,
  isAllowedAdvancedSecondaryGrade,
  maximumStudentCount,
  minimumStudentCount,
  preferredShiftOptions,
  type EducationalBusRequestFormData,
  type EducationalBusRequestFormErrors,
  type PreferredShift,
  type PublicAvailabilityDay,
  validateEducationalBusAttachment,
  validateEducationalBusRequestForm,
  weekdayLabels,
} from '@/lib/educational-bus-requests'
import styles from './form.module.css'
import { FormField } from './FormField'
import { Input } from './Input'
import { Select } from './Select'
import { StatusBanner } from './StatusBanner'
import { SubmitButton } from './SubmitButton'
import { Textarea } from './Textarea'

type SubmitState =
  | { type: 'idle' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }

function buildMonthKey(year: number, month: number) {
  return `${year}-${`${month}`.padStart(2, '0')}`
}

function getDateParts(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function shiftDateKey(dateKey: string, offset: number) {
  const parts = getDateParts(dateKey)
  if (!parts) return dateKey
  const shifted = new Date(parts.year, parts.month - 1, parts.day + offset)
  return `${shifted.getFullYear()}-${`${shifted.getMonth() + 1}`.padStart(2, '0')}-${`${shifted.getDate()}`.padStart(2, '0')}`
}

function getWeekStartDateKey(dateKey: string) {
  const parts = getDateParts(dateKey)
  if (!parts) return dateKey
  const date = new Date(parts.year, parts.month - 1, parts.day)
  const mondayFirstDayIndex = (date.getDay() + 6) % 7
  return shiftDateKey(dateKey, -mondayFirstDayIndex)
}

function buildWeekDays(weekStartKey: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const dateKey = shiftDateKey(weekStartKey, index)
    const parts = getDateParts(dateKey)
    return {
      dateKey,
      dayNumber: parts?.day ?? index + 1,
    }
  })
}

function shiftWeekStartKey(weekStartKey: string, offset: number) {
  return shiftDateKey(weekStartKey, offset * 7)
}

function getMonthKeyFromDateKey(dateKey: string) {
  return dateKey.slice(0, 7)
}

function AvailabilityCalendar({
  currentWeekStartKey,
  selectedDate,
  selectedShift,
  availabilityByDate,
  disabled,
  loading,
  onMonthChange,
  onWeekChange,
  onSelectSlot,
}: {
  currentWeekStartKey: string
  selectedDate: string
  selectedShift: PreferredShift | ''
  availabilityByDate: Record<string, PublicAvailabilityDay>
  disabled: boolean
  loading: boolean
  onMonthChange: (monthKey: string) => void
  onWeekChange: (weekStartKey: string) => void
  onSelectSlot: (dateKey: string, shift: PreferredShift) => void
}) {
  const weekDays = useMemo(() => buildWeekDays(currentWeekStartKey), [currentWeekStartKey])
  const handleWeekChange = (nextWeekStartKey: string) => {
    onWeekChange(nextWeekStartKey)
    onMonthChange(getMonthKeyFromDateKey(nextWeekStartKey))
  }

  const renderDayCard = ({
    dateKey,
    dayNumber,
    isCurrentMonth,
  }: {
    dateKey: string
    dayNumber: number
    isCurrentMonth: boolean
  }) => {
    const availability = availabilityByDate[dateKey]
    const isSelectedDay = selectedDate === dateKey
    const isDisabledDay = disabled || !isCurrentMonth || !availability || availability.isPast || !availability.isCircuitDay

    return (
      <div
        key={`${dateKey}-${isCurrentMonth ? 'current' : 'outside'}`}
        className={[
          styles.publicCalendarDay,
          !isCurrentMonth ? styles.publicCalendarDayMuted : '',
          isDisabledDay ? styles.publicCalendarDayDisabled : '',
          isSelectedDay ? styles.publicCalendarDaySelected : '',
        ].join(' ').trim()}
      >
        <div className={styles.publicCalendarDayTop}>
          <span>{`${dayNumber}`.padStart(2, '0')}</span>
          {availability?.weekday ? <small>{weekdayLabels[availability.weekday].slice(0, 3)}</small> : null}
        </div>

        <div className={styles.publicCalendarShiftList}>
          {preferredShiftOptions.map((option) => {
            const shiftStatus = availability?.shifts.find((item) => item.shift === option.value)?.status || 'disabled'
            const isAvailable = shiftStatus === 'available'
            const isSelected = isSelectedDay && selectedShift === option.value
            const label =
              shiftStatus === 'available'
                ? `${option.label} disponible`
                : shiftStatus === 'occupied'
                  ? `${option.label} ocupado`
                  : shiftStatus === 'past'
                    ? `${option.label} pasado`
                    : `${option.label} no disponible`

            return (
              <button
                key={option.value}
                type="button"
                className={[
                  styles.publicCalendarShift,
                  styles[`publicCalendarShift_${shiftStatus}`],
                  isSelected ? styles.publicCalendarShiftSelected : '',
                ].join(' ').trim()}
                disabled={!isAvailable}
                onClick={() => onSelectSlot(dateKey, option.value as PreferredShift)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.publicCalendar}>
      {disabled ? (
        <div className={styles.calendarEmptyNotice}>Seleccioná un circuito para ver la disponibilidad.</div>
      ) : null}
      {loading ? (
        <div className={styles.calendarEmptyNotice}>Consultando turnos disponibles...</div>
      ) : null}

      <div className={styles.publicCalendarHeader}>
        <button type="button" className={styles.calendarNavButton} onClick={() => handleWeekChange(shiftWeekStartKey(currentWeekStartKey, -1))} disabled={disabled}>
          ‹
        </button>
        <strong>Semana del {formatDateToDisplay(currentWeekStartKey)}</strong>
        <button type="button" className={styles.calendarNavButton} onClick={() => handleWeekChange(shiftWeekStartKey(currentWeekStartKey, 1))} disabled={disabled}>
          ›
        </button>
      </div>

      <div className={styles.publicCalendarWeekList}>
        {weekDays.map((day) => renderDayCard({ ...day, isCurrentMonth: true }))}
      </div>
    </div>
  )
}

export function EducationalBusRequestForm() {
  const [formData, setFormData] = useState<EducationalBusRequestFormData>(initialEducationalBusRequestFormData)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [errors, setErrors] = useState<EducationalBusRequestFormErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle' })
  const [loading, setLoading] = useState(false)
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null)
  const [currentMonthKey, setCurrentMonthKey] = useState(() => getTodayDateStringInBuenosAires().slice(0, 7))
  const [currentWeekStartKey, setCurrentWeekStartKey] = useState(() => getWeekStartDateKey(getTodayDateStringInBuenosAires()))
  const [availabilityByDate, setAvailabilityByDate] = useState<Record<string, PublicAvailabilityDay>>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const formCardRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedWeekday = useMemo(() => getBusinessWeekday(formData.requestedDate), [formData.requestedDate])
  const availableWeekdays = useMemo(() => getAvailableWeekdaysForCircuit(formData.circuit), [formData.circuit])
  const selectedDayAvailability = formData.requestedDate ? availabilityByDate[formData.requestedDate] : undefined
  const availableShifts = selectedDayAvailability?.availableShifts || []
  const isMemoryCircuit = formData.circuit === 'memoria'

  useEffect(() => {
    if (!formData.circuit) {
      setAvailabilityByDate({})
      return
    }

    const controller = new AbortController()
    setAvailabilityLoading(true)

    const monthsToFetch = Array.from(new Set([
      currentMonthKey,
      ...buildWeekDays(currentWeekStartKey).map((day) => getMonthKeyFromDateKey(day.dateKey)),
    ]))

    Promise.all(monthsToFetch.map(async (monthKey) => {
      const response = await fetch(`/api/educational-bus-requests/availability?circuit=${formData.circuit}&month=${monthKey}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo consultar la disponibilidad.')
      return (result.data?.days || []) as PublicAvailabilityDay[]
    }))
      .then((monthDays) => {
        setAvailabilityByDate(monthDays.flat().reduce<Record<string, PublicAvailabilityDay>>((acc, day) => {
          acc[day.dateKey] = day
          return acc
        }, {}))
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setAvailabilityByDate({})
        setAvailabilityMessage('No pudimos consultar la disponibilidad en este momento. Intentá nuevamente.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvailabilityLoading(false)
      })

    return () => controller.abort()
  }, [currentMonthKey, currentWeekStartKey, formData.circuit])

  useEffect(() => {
    if (!formData.requestedDate || availabilityLoading) return
    const selectedAvailability = availabilityByDate[formData.requestedDate]
    if (!selectedAvailability) return

    if (selectedAvailability.isPast || !selectedAvailability.isCircuitDay) {
      setFormData((current) => ({ ...current, requestedDate: '', preferredShift: '' }))
      setAvailabilityMessage('La fecha anterior se limpió porque no está disponible para el circuito seleccionado.')
    }
  }, [availabilityByDate, availabilityLoading, formData.requestedDate])

  useEffect(() => {
    if (formData.preferredShift && !availableShifts.includes(formData.preferredShift)) {
      setFormData((current) => ({ ...current, preferredShift: '' }))
      setAvailabilityMessage('El turno anterior se limpió porque ya no está disponible para la nueva combinación seleccionada.')
      setErrors((current) => {
        const next = { ...current }
        delete next.preferredShift
        return next
      })
    }
  }, [availableShifts, formData.preferredShift])

  useEffect(() => {
    if (!formData.circuit || !formData.requestedDate) {
      setAvailabilityMessage(null)
      return
    }

    if (!selectedWeekday || !availableWeekdays.includes(selectedWeekday)) {
      setAvailabilityMessage('La fecha elegida no coincide con un día disponible para el circuito seleccionado.')
      return
    }

    if (availableShifts.length === 0) {
      setAvailabilityMessage('No hay turnos disponibles para la combinación elegida.')
      return
    }

    setAvailabilityMessage(null)
  }, [availableShifts.length, availableWeekdays, formData.circuit, formData.requestedDate, selectedWeekday])

  useEffect(() => {
    if (!isMemoryCircuit) {
      setErrors((current) => {
        if (!current.gradeYear?.includes('Memoria')) return current
        const next = { ...current }
        delete next.gradeYear
        return next
      })
      return
    }

    if (formData.gradeYear && !isAllowedAdvancedSecondaryGrade(formData.gradeYear)) {
      setErrors((current) => ({
        ...current,
        gradeYear: 'El circuito Memoria está disponible únicamente para los últimos 3 años del nivel secundario.',
      }))
    }
  }, [formData.gradeYear, isMemoryCircuit])

  const updateField = <K extends keyof EducationalBusRequestFormData>(field: K, value: EducationalBusRequestFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSelectAvailabilitySlot = (dateKey: string, shift: PreferredShift) => {
    setFormData((current) => ({ ...current, requestedDate: dateKey, preferredShift: shift }))
    setCurrentWeekStartKey(getWeekStartDateKey(dateKey))
    setCurrentMonthKey(getMonthKeyFromDateKey(dateKey))
    setErrors((current) => {
      const next = { ...current }
      delete next.requestedDate
      delete next.preferredShift
      return next
    })
    setAvailabilityMessage(null)
  }

  const handleCircuitChange = (value: EducationalBusRequestFormData['circuit']) => {
    const todayKey = getTodayDateStringInBuenosAires()
    setFormData((current) => ({ ...current, circuit: value, requestedDate: '', preferredShift: '' }))
    setCurrentWeekStartKey(getWeekStartDateKey(todayKey))
    setCurrentMonthKey(getMonthKeyFromDateKey(todayKey))
    setAvailabilityMessage(null)
    setErrors((current) => {
      const next = { ...current }
      delete next.circuit
      delete next.requestedDate
      delete next.preferredShift
      return next
    })
  }

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    setAttachment(nextFile)
    setErrors((current) => {
      if (!current.attachment) return current
      const next = { ...current }
      delete next.attachment
      return next
    })
  }

  const scrollToFeedback = () => {
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validateEducationalBusRequestForm(formData)
    const attachmentError = validateEducationalBusAttachment(attachment)
    if (attachmentError) {
      validationErrors.attachment = attachmentError
    }
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setSubmitState({ type: 'error', message: 'Revisá los campos marcados antes de enviar la solicitud.' })
      scrollToFeedback()
      return
    }

    setLoading(true)
    setSubmitState({ type: 'idle' })

    try {
      const payload = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        payload.append(key, value)
      })
      payload.append('attachment', attachment as File)

      const response = await fetch('/api/educational-bus-requests', {
        method: 'POST',
        body: payload,
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        throw new Error(result.error || 'No se pudo registrar la solicitud.')
      }

      setFormData(initialEducationalBusRequestFormData)
      setAttachment(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setErrors({})
      setAvailabilityMessage(null)
      setSubmitState({
        type: 'success',
        message: 'Solicitud enviada. El equipo evaluará el pedido según prioridad institucional y disponibilidad.',
      })
      scrollToFeedback()
    } catch (error) {
      setSubmitState({
        type: 'error',
        message: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      })
      scrollToFeedback()
    } finally {
      setLoading(false)
    }
  }

  const weekdayHint = selectedWeekday
    ? `La fecha elegida corresponde a ${weekdayLabels[selectedWeekday]}.`
    : 'Elegí una fecha para verificar el día disponible.'

  const availableDaysText = formData.circuit
    ? availableWeekdays.map((weekday) => weekdayLabels[weekday]).join(', ')
    : 'Selecciona un circuito para ver los días habilitados.'

  const attachmentHint = attachment
    ? `Archivo seleccionado: ${attachment.name}`
    : `Adjunta la nota modelo completa en formato ${acceptedEducationalBusAttachmentExtensions.join(', ')}.`

  return (
    <div ref={formCardRef} className={styles.formCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Completá la solicitud</h2>
          <p className={styles.sectionText}>Elegí circuito, fecha disponible y adjuntá la nota modelo.</p>
        </div>
        <div className={styles.sectionBadge}>Formulario oficial</div>
      </div>

      {submitState.type === 'success' ? (
        <StatusBanner tone="success" title="Solicitud recibida" description={submitState.message} />
      ) : null}
      {submitState.type === 'error' ? (
        <StatusBanner tone="error" title="No pudimos enviar la solicitud" description={submitState.message} />
      ) : null}

      <div className={styles.availabilityCard}>
        <p className={styles.availabilityTitle}>Disponibilidad de circuitos</p>
        <p className={styles.availabilityText}>Los días y turnos disponibles dependen del circuito seleccionado.</p>
        <p className={styles.availabilityMeta}>
          {formData.circuit
            ? `${getCircuitLabel(formData.circuit)}: ${availableDaysText}.`
            : 'Selecciona un circuito para conocer qué días y turnos están habilitados.'}
        </p>
      </div>

      <div className={styles.circuitNotice}>
        <p className={styles.circuitNoticeTitle}>Nota obligatoria</p>
        <p className={styles.circuitNoticeText}>Descargá el modelo, completalo y adjuntalo junto con la solicitud en formato .docx.</p>
        <a href={educationalBusTemplatePublicPath} download className={styles.templateLink}>
          {educationalBusTemplateLabel}
        </a>
      </div>

      {isMemoryCircuit ? (
        <div className={styles.circuitNotice}>
          <p className={styles.circuitNoticeTitle}>Circuito Memoria</p>
          <p className={styles.circuitNoticeText}>Este circuito está disponible únicamente para los últimos 3 años del nivel secundario.</p>
          <p className={styles.circuitNoticeText}>Disponibilidad limitada: frecuencia de una vez por semana, los jueves por la mañana.</p>
        </div>
      ) : formData.circuit === 'historico_cultural' ? (
        <div className={styles.circuitNotice}>
          <p className={styles.circuitNoticeTitle}>Circuito Histórico Cultural</p>
          <p className={styles.circuitNoticeText}>Disponible los martes y miércoles por la mañana y la tarde, los jueves por la tarde y los viernes por la mañana.</p>
        </div>
      ) : null}

      {availabilityMessage ? (
        <div className={styles.circuitNotice}>
          <p className={styles.circuitNoticeText}>{availabilityMessage}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.grid}>
          <FormField label="Circuito" required error={errors.circuit}>
            <Select value={formData.circuit} onChange={(event) => handleCircuitChange(event.target.value as EducationalBusRequestFormData['circuit'])} hasError={Boolean(errors.circuit)}>
              <option value="">Seleccionar</option>
              {circuitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Tipo de institución" required error={errors.institutionType}>
            <Select value={formData.institutionType} onChange={(event) => updateField('institutionType', event.target.value as EducationalBusRequestFormData['institutionType'])} hasError={Boolean(errors.institutionType)}>
              <option value="">Seleccionar</option>
              {institutionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Nombre de la institución" required error={errors.institutionName}>
            <Input value={formData.institutionName} onChange={(event) => updateField('institutionName', event.target.value)} placeholder="Ej. Escuela Municipal Belgrano" hasError={Boolean(errors.institutionName)} />
          </FormField>

          <FormField label="Dirección de la escuela" required error={errors.schoolAddress}>
            <Input value={formData.schoolAddress} onChange={(event) => updateField('schoolAddress', event.target.value)} placeholder="Calle, número, barrio o localidad" hasError={Boolean(errors.schoolAddress)} />
          </FormField>

          <FormField label="Responsable" required error={errors.contactName}>
            <Input value={formData.contactName} onChange={(event) => updateField('contactName', event.target.value)} placeholder="Nombre y apellido" hasError={Boolean(errors.contactName)} />
          </FormField>

          <FormField label="Cargo del responsable" required error={errors.contactRole}>
            <Select value={formData.contactRole} onChange={(event) => updateField('contactRole', event.target.value)} hasError={Boolean(errors.contactRole)}>
              <option value="">Seleccionar</option>
              {contactRoleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Teléfono de contacto" required hint="Se valida formato general para línea fija o móvil." error={errors.contactPhone}>
            <Input type="tel" value={formData.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} placeholder="+54 381 555 1234" hasError={Boolean(errors.contactPhone)} />
          </FormField>

          <FormField label="Email de contacto" required error={errors.contactEmail}>
            <Input type="email" value={formData.contactEmail} onChange={(event) => updateField('contactEmail', event.target.value)} placeholder="correo@institucion.edu.ar" hasError={Boolean(errors.contactEmail)} />
          </FormField>

          <FormField label="Cantidad de alumnos" required hint={`Se permiten grupos de ${minimumStudentCount} a ${maximumStudentCount} alumnos.`} error={errors.studentCount}>
            <Input type="number" min={`${minimumStudentCount}`} max={`${maximumStudentCount}`} value={formData.studentCount} onChange={(event) => updateField('studentCount', event.target.value)} placeholder="Ej. 32" hasError={Boolean(errors.studentCount)} />
          </FormField>

          <FormField label="Grado o año" required hint={formData.gradeYear ? `Seleccionado: ${getGradeYearLabel(formData.gradeYear)}.` : undefined} error={errors.gradeYear}>
            <Select value={formData.gradeYear} onChange={(event) => updateField('gradeYear', event.target.value)} hasError={Boolean(errors.gradeYear)}>
              <option value="">Seleccionar</option>
              {gradeYearOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={isMemoryCircuit && !isAllowedAdvancedSecondaryGrade(option.value)}>
                  {option.label}{isMemoryCircuit && !isAllowedAdvancedSecondaryGrade(option.value) ? ' - no disponible para Memoria' : ''}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Fecha y turno"
            required
            hint={
              formData.requestedDate && formData.preferredShift
                ? `Seleccionado: ${formatDateToDisplay(formData.requestedDate)} · ${preferredShiftOptions.find((option) => option.value === formData.preferredShift)?.label}. ${weekdayHint}`
                : `${weekdayHint} Los turnos ocupados no se pueden seleccionar.`
            }
            error={errors.requestedDate || errors.preferredShift}
            className={styles.gridFull}
          >
            <AvailabilityCalendar
              currentWeekStartKey={currentWeekStartKey}
              selectedDate={formData.requestedDate}
              selectedShift={formData.preferredShift}
              availabilityByDate={availabilityByDate}
              disabled={!formData.circuit}
              loading={availabilityLoading}
              onMonthChange={setCurrentMonthKey}
              onWeekChange={setCurrentWeekStartKey}
              onSelectSlot={handleSelectAvailabilitySlot}
            />
          </FormField>

          <FormField label="Adjuntar nota modelo" required hint={attachmentHint} error={errors.attachment} className={styles.gridFull}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className={styles.control}
              onChange={handleAttachmentChange}
            />
          </FormField>

          <FormField label="Observaciones adicionales" className={styles.gridFull}>
            <Textarea value={formData.additionalNotes} onChange={(event) => updateField('additionalNotes', event.target.value)} placeholder="Comentarios sobre el grupo, accesibilidad, temas curriculares o necesidades particulares." />
          </FormField>
        </div>

        <div className={styles.actions}>
          <p className={styles.buttonTextMuted}>Al enviar, la solicitud quedará registrada para su evaluación. La confirmación final dependerá del cupo disponible, la asignación del servicio y la presentación correcta de la nota adjunta.</p>
          <SubmitButton loading={loading} />
        </div>
      </form>
    </div>
  )
}

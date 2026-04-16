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
  getAvailableShiftsForCircuitAndDate,
  getAvailableWeekdaysForCircuit,
  getCircuitLabel,
  getGradeYearLabel,
  getTodayDateStringInBuenosAires,
  getBusinessWeekday,
  gradeYearOptions,
  initialEducationalBusRequestFormData,
  institutionTypeOptions,
  preferredShiftOptions,
  type EducationalBusRequestFormData,
  type EducationalBusRequestFormErrors,
  type PreferredShift,
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

export function EducationalBusRequestForm() {
  const [formData, setFormData] = useState<EducationalBusRequestFormData>(initialEducationalBusRequestFormData)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [errors, setErrors] = useState<EducationalBusRequestFormErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle' })
  const [loading, setLoading] = useState(false)
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null)
  const formCardRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const today = useMemo(() => getTodayDateStringInBuenosAires(), [])
  const selectedWeekday = useMemo(() => getBusinessWeekday(formData.requestedDate), [formData.requestedDate])
  const availableWeekdays = useMemo(() => getAvailableWeekdaysForCircuit(formData.circuit), [formData.circuit])
  const availableShifts = useMemo(() => getAvailableShiftsForCircuitAndDate(formData.circuit, formData.requestedDate), [formData.circuit, formData.requestedDate])
  const isMemoryCircuit = formData.circuit === 'memoria'

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

  const updateField = <K extends keyof EducationalBusRequestFormData>(field: K, value: EducationalBusRequestFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
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
          <h2 className={styles.sectionTitle}>Completa la solicitud</h2>
          <p className={styles.sectionText}>Carguen primero el circuito, luego los datos de la institución, la fecha y el archivo obligatorio con la nota modelo completa.</p>
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
            <Select value={formData.circuit} onChange={(event) => updateField('circuit', event.target.value as EducationalBusRequestFormData['circuit'])} hasError={Boolean(errors.circuit)}>
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

          <FormField label="Cantidad de alumnos" required error={errors.studentCount}>
            <Input type="number" min="1" value={formData.studentCount} onChange={(event) => updateField('studentCount', event.target.value)} placeholder="Ej. 32" hasError={Boolean(errors.studentCount)} />
          </FormField>

          <FormField label="Grado o año" required hint={formData.gradeYear ? `Seleccionado: ${getGradeYearLabel(formData.gradeYear)}.` : undefined} error={errors.gradeYear}>
            <Select value={formData.gradeYear} onChange={(event) => updateField('gradeYear', event.target.value)} hasError={Boolean(errors.gradeYear)}>
              <option value="">Seleccionar</option>
              {gradeYearOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Fecha solicitada" required hint={`${weekdayHint} Formato visible: ${formatDateToDisplay(today)} (dd-mm-aaaa).`} error={errors.requestedDate}>
            <Input type="date" min={today} value={formData.requestedDate} onChange={(event) => updateField('requestedDate', event.target.value)} hasError={Boolean(errors.requestedDate)} />
          </FormField>

          <FormField label="Días habilitados para el circuito" hint={availableDaysText}>
            <Select value={selectedWeekday && availableWeekdays.includes(selectedWeekday) ? selectedWeekday : ''} disabled>
              <option value="">{formData.circuit ? 'Selecciona una fecha compatible' : 'Selecciona un circuito primero'}</option>
              {availableWeekdays.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {weekdayLabels[weekday]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Turno preferido" required hint={formData.circuit ? 'Las opciones inválidas quedan deshabilitadas automáticamente.' : 'Selecciona un circuito y una fecha para habilitar turnos.'} error={errors.preferredShift}>
            <Select
              value={formData.preferredShift}
              onChange={(event) => updateField('preferredShift', event.target.value as EducationalBusRequestFormData['preferredShift'])}
              hasError={Boolean(errors.preferredShift)}
              disabled={!formData.circuit || !formData.requestedDate}
            >
              <option value="">Seleccionar</option>
              {preferredShiftOptions.map((option) => {
                const isEnabled = availableShifts.includes(option.value as PreferredShift)
                return (
                  <option key={option.value} value={option.value} disabled={!isEnabled}>
                    {option.label}{isEnabled ? '' : ' - no disponible'}
                  </option>
                )
              })}
            </Select>
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

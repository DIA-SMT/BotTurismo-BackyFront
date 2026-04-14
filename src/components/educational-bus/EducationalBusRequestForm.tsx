'use client'

import type { FormEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
  contactRoleOptions,
  formatDateToDisplay,
  getTodayDateStringInBuenosAires,
  initialEducationalBusRequestFormData,
  institutionTypeOptions,
  preferredShiftOptions,
  type EducationalBusRequestFormData,
  type EducationalBusRequestFormErrors,
  validateEducationalBusRequestForm,
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
  const [errors, setErrors] = useState<EducationalBusRequestFormErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle' })
  const [loading, setLoading] = useState(false)
  const formCardRef = useRef<HTMLDivElement | null>(null)

  const today = useMemo(() => getTodayDateStringInBuenosAires(), [])

  const updateField = <K extends keyof EducationalBusRequestFormData>(field: K, value: EducationalBusRequestFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const scrollToFeedback = () => {
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validateEducationalBusRequestForm(formData)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setSubmitState({ type: 'error', message: 'Revisá los campos marcados antes de enviar la solicitud.' })
      scrollToFeedback()
      return
    }

    setLoading(true)
    setSubmitState({ type: 'idle' })

    try {
      const response = await fetch('/api/educational-bus-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        throw new Error(result.error || 'No se pudo registrar la solicitud.')
      }

      setFormData(initialEducationalBusRequestFormData)
      setErrors({})
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

  return (
    <div ref={formCardRef} className={styles.formCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Completa la solicitud</h2>
          <p className={styles.sectionText}>Carguen los datos de la institución y del grupo que desea participar.</p>
        </div>
        <div className={styles.sectionBadge}>Formulario oficial</div>
      </div>

      {submitState.type === 'success' ? (
        <StatusBanner tone="success" title="Solicitud recibida" description={submitState.message} />
      ) : null}
      {submitState.type === 'error' ? (
        <StatusBanner tone="error" title="No pudimos enviar la solicitud" description={submitState.message} />
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.grid}>
          <FormField label="Nombre de la institución" required error={errors.institutionName}>
            <Input value={formData.institutionName} onChange={(event) => updateField('institutionName', event.target.value)} placeholder="Ej. Escuela Municipal Belgrano" hasError={Boolean(errors.institutionName)} />
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

          <FormField label="Dirección de la escuela" required error={errors.schoolAddress} className={styles.gridFull}>
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

          <FormField label="Grado o año" required error={errors.gradeYear}>
            <Input value={formData.gradeYear} onChange={(event) => updateField('gradeYear', event.target.value)} placeholder="Ej. 4° grado / 2° año" hasError={Boolean(errors.gradeYear)} />
          </FormField>

          <FormField label="Fecha solicitada" required hint={`Formato visible: ${formatDateToDisplay(today)} (dd-mm-aaaa).`} error={errors.requestedDate}>
            <Input type="date" min={today} value={formData.requestedDate} onChange={(event) => updateField('requestedDate', event.target.value)} hasError={Boolean(errors.requestedDate)} />
          </FormField>

          <FormField label="Turno preferido" required error={errors.preferredShift}>
            <Select value={formData.preferredShift} onChange={(event) => updateField('preferredShift', event.target.value as EducationalBusRequestFormData['preferredShift'])} hasError={Boolean(errors.preferredShift)}>
              <option value="">Seleccionar</option>
              {preferredShiftOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Observaciones adicionales" className={styles.gridFull}>
            <Textarea value={formData.additionalNotes} onChange={(event) => updateField('additionalNotes', event.target.value)} placeholder="Comentarios sobre el grupo, accesibilidad, temas curriculares o necesidades particulares." />
          </FormField>
        </div>

        <div className={styles.actions}>
          <p className={styles.buttonTextMuted}>Al enviar, la solicitud quedará registrada para su evaluación. La confirmación final dependerá del cupo disponible y de la asignación del servicio.</p>
          <SubmitButton loading={loading} />
        </div>
      </form>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  getCircuitLabel,
  getGradeYearLabel,
  formatDateTimeToDisplay,
  formatDateToDisplay,
  getInstitutionTypeLabel,
  getRequestStatusLabel,
  getShiftLabel,
  requestStatusOptions,
  type EducationalBusRequest,
  type EducationalBusRequestStatus,
} from '@/lib/educational-bus-requests'
import { ArrowLeft, Download, Save } from 'lucide-react'

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="form-group" style={{ marginBottom: 18 }}>
      <label>{label}</label>
      <div className="input" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
        {value || '-'}
      </div>
    </div>
  )
}

export default function EducationalRequestDetailPage({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [request, setRequest] = useState<EducationalBusRequest | null>(null)
  const [status, setStatus] = useState<EducationalBusRequestStatus>('pending')
  const [internalNotes, setInternalNotes] = useState('')
  const [guides, setGuides] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const fetchRequest = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/educational-bus-requests/${requestId}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar la solicitud.')
      setRequest(result.data)
      setStatus(result.data.status)
      setInternalNotes(result.data.internal_notes || '')
      setGuides(result.data.guides || '')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cargar la solicitud.')
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    fetchRequest()
  }, [fetchRequest])

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/educational-bus-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, internalNotes, guides }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la solicitud.')
      setRequest(result.data)
      router.push('/admin/solicitudes?saved=1')
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar la solicitud.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <Link href="/admin/solicitudes" className="btn btn-secondary" style={{ marginBottom: 16 }}>
            <ArrowLeft size={14} />
            Volver al listado
          </Link>
          <h2>Detalle de solicitud #{requestId}</h2>
          <p>Revisión completa de datos institucionales y gestión de estado.</p>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            Cargando solicitud...
          </div>
        ) : !request ? (
          <div className="empty-state">
            <div className="icon">?</div>
            <p>{feedback || 'No se encontró la solicitud.'}</p>
          </div>
        ) : (
          <div className="charts-grid">
            <section className="chart-card">
              <h3>Datos de la institución</h3>
              <DetailRow label="Institución" value={request.institution_name} />
              <DetailRow label="Tipo de institución" value={getInstitutionTypeLabel(request.institution_type)} />
              <DetailRow label="Dirección" value={request.school_address} />
              <DetailRow label="Cantidad de alumnos" value={request.student_count} />
              <DetailRow label="Grado o año" value={getGradeYearLabel(request.grade_year)} />
              <DetailRow label="Circuito" value={getCircuitLabel(request.circuit)} />
              <DetailRow label="Fecha solicitada" value={formatDateToDisplay(request.requested_date)} />
              <DetailRow label="Turno preferido" value={getShiftLabel(request.preferred_shift)} />
              <DetailRow label="Nota adjunta" value={request.attachment_name || 'Sin adjunto registrado'} />
              <DetailRow label="Creada el" value={formatDateTimeToDisplay(request.created_at)} />
              <DetailRow label="Observaciones" value={request.additional_notes || '-'} />

              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginTop: 12 }}>
                {request.attachment_path && !request.attachment_path.startsWith('migracion/') ? (
                  <a href={`/api/educational-bus-requests/${request.id}/attachment`} className="btn btn-secondary">
                    <Download size={14} />
                    Descargar adjunto
                  </a>
                ) : null}
              </div>
            </section>

            <section className="chart-card">
              <h3>Responsable y gestión</h3>
              <DetailRow label="Nombre del responsable" value={request.contact_name} />
              <DetailRow label="Cargo" value={request.contact_role} />
              <DetailRow label="Teléfono" value={request.contact_phone} />
              <DetailRow label="Email" value={request.contact_email} />

              <div className="form-group">
                <label>Estado</label>
                <select className="select" value={status} onChange={(event) => setStatus(event.target.value as EducationalBusRequestStatus)} style={{ width: '100%' }}>
                  {requestStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="td-muted" style={{ marginTop: 8 }}>
                  Estado actual: {getRequestStatusLabel(request.status)}
                </p>
              </div>

              <div className="form-group">
                <label>Notas internas</label>
                <textarea className="input" style={{ width: '100%', minHeight: 130 }} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Comentarios internos para seguimiento del caso." />
              </div>

              <div className="form-group">
                <label>Guías</label>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  value={guides}
                  onChange={(event) => setGuides(event.target.value)}
                  placeholder="Nombre del guía o nombres separados por coma."
                />
                <p className="td-muted" style={{ marginTop: 8 }}>
                  Campo opcional para asignación operativa.
                </p>
              </div>

              {feedback ? (
                <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)', marginBottom: 12 }}>
                  {feedback}
                </div>
              ) : null}

              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </section>
          </div>
        )}
      </div>
    </>
  )
}

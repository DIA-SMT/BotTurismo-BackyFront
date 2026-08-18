'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { Ban, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react'
import { preferredShiftOptions, weekdayLabels, type BusinessWeekday, type PreferredShift } from '@/lib/educational-bus-requests'
import {
  describeEducationalAvailability,
  type EducationalAvailabilityMap,
  type EducationalCircuitRecord,
} from '@/lib/educational-circuits'

const formWeekdays: BusinessWeekday[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

interface CircuitFormState {
  name: string
  summary: string
  paragraphsText: string
  availability: EducationalAvailabilityMap
  sortOrder: string
}

const emptyForm: CircuitFormState = {
  name: '',
  summary: '',
  paragraphsText: '',
  availability: {},
  sortOrder: '',
}

function recordToForm(record: EducationalCircuitRecord): CircuitFormState {
  return {
    name: record.name || '',
    summary: record.summary || '',
    paragraphsText: (record.paragraphs || []).join('\n\n'),
    availability: record.availability || {},
    sortOrder: String(record.sort_order ?? ''),
  }
}

function formToPayload(form: CircuitFormState, extra: Record<string, unknown> = {}) {
  return {
    name: form.name,
    summary: form.summary,
    paragraphs: form.paragraphsText
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
    availability: form.availability,
    sortOrder: form.sortOrder === '' ? null : Number(form.sortOrder),
    ...extra,
  }
}

export function EducationalCircuitsPanel({
  records,
  loading,
  loadError,
  onChanged,
}: {
  records: EducationalCircuitRecord[]
  loading: boolean
  loadError: string | null
  onChanged: () => void
}) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CircuitFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormErrors({})
    setShowForm(true)
  }

  const startEdit = (record: EducationalCircuitRecord) => {
    setEditingId(record.id)
    setForm(recordToForm(record))
    setFormErrors({})
    setShowForm(true)
  }

  const toggleShift = (weekday: BusinessWeekday, shift: PreferredShift) => {
    setForm((current) => {
      const currentShifts = current.availability[weekday] || []
      const nextShifts = currentShifts.includes(shift)
        ? currentShifts.filter((item) => item !== shift)
        : [...currentShifts, shift]
      const availability = { ...current.availability }
      if (nextShifts.length > 0) {
        availability[weekday] = nextShifts
      } else {
        delete availability[weekday]
      }
      return { ...current, availability }
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    setFormErrors({})
    try {
      const url = editingId ? `/api/admin/educational-circuits/${editingId}` : '/api/admin/educational-circuits'
      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(form)),
      })
      const result = await response.json()
      if (!response.ok) {
        if (result.fieldErrors) setFormErrors(result.fieldErrors)
        throw new Error(result.error || 'No se pudo guardar el circuito.')
      }
      setFeedback(`Circuito ${editingId ? 'actualizado' : 'creado'} correctamente.`)
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
      onChanged()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar el circuito.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (record: EducationalCircuitRecord) => {
    if (record.active === false) {
      const hasDays = Object.keys(record.availability || {}).length > 0
      if (!hasDays && !window.confirm('Este circuito no tiene días habilitados: se podrá elegir pero sin fechas disponibles. ¿Activarlo igual?')) {
        return
      }
    }
    setBusyId(record.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/educational-circuits/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleActive: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el circuito.')
      setFeedback(record.active ? 'Circuito desactivado: ya no aparece en el formulario público.' : 'Circuito activado.')
      onChanged()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar el circuito.')
    } finally {
      setBusyId(null)
    }
  }

  const removeCircuit = async (record: EducationalCircuitRecord) => {
    if (!window.confirm(`¿Eliminar el circuito "${record.name}"? Esta acción no se puede deshacer.`)) return
    setBusyId(record.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/educational-circuits/${record.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo eliminar el circuito.')
      setFeedback('Circuito eliminado.')
      onChanged()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar el circuito.')
    } finally {
      setBusyId(null)
    }
  }

  const fieldStyle = { display: 'grid', gap: 6, fontSize: 13 } as const

  return (
    <div className="table-container" style={{ marginBottom: 20 }}>
      <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
        <span className="td-muted" style={{ fontSize: 13 }}>
          Catálogo exclusivo del bus educativo (separado del turístico). Los circuitos activos aparecen en el formulario público con sus días y turnos.
        </span>
        <button className="btn btn-primary" onClick={startCreate}>
          <Plus size={14} />
          Nuevo circuito
        </button>
      </div>

      {feedback ? (
        <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)', margin: '0 16px 12px' }}>
          {feedback}
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleSubmit} style={{ padding: '4px 16px 18px' }}>
          <h3 style={{ margin: '10px 0 14px' }}>{editingId ? 'Editar circuito educativo' : 'Nuevo circuito educativo'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label style={fieldStyle}>
              Nombre *
              <input className="input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Circuito Escultórico Museo a Cielo Abierto" />
              {formErrors.name ? <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.name}</span> : null}
            </label>
            <label style={fieldStyle}>
              Resumen (una línea)
              <input className="input" value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Ej. Arte y patrimonio en el Parque 9 de Julio." />
            </label>
            <label style={fieldStyle}>
              Orden en la página
              <input type="number" min={0} className="input" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} placeholder="Menor = primero" />
            </label>
          </div>

          <label style={{ ...fieldStyle, marginTop: 12 }}>
            Descripción (separá los párrafos con una línea en blanco)
            <textarea className="input" style={{ minHeight: 110, padding: '8px 12px' }} value={form.paragraphsText} onChange={(event) => setForm((current) => ({ ...current, paragraphsText: event.target.value }))} />
          </label>

          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13 }}>Días y turnos habilitados para este circuito</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 8 }}>
              {formWeekdays.map((weekday) => (
                <div key={weekday} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{weekdayLabels[weekday]}</div>
                  {preferredShiftOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2" style={{ fontSize: 13, marginBottom: 4, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={(form.availability[weekday] || []).includes(option.value)}
                        onChange={() => toggleShift(weekday, option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear circuito'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Circuito</th>
              <th>Días habilitados</th>
              <th>Orden</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <div className="loading-state">
                    <div className="spinner" />
                    Cargando circuitos...
                  </div>
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <p>{loadError}</p>
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <p>No hay circuitos educativos cargados todavía.</p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div className="td-text-primary">{record.name}</div>
                    {record.summary ? <div className="td-muted">{record.summary}</div> : null}
                  </td>
                  <td>
                    <span className="td-muted" style={{ fontSize: 13 }}>
                      {describeEducationalAvailability(record.availability || {})}
                    </span>
                  </td>
                  <td>{record.sort_order}</td>
                  <td>
                    {record.active ? (
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Activo</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(148,163,184,0.18)', color: '#94a3b8' }}>Inactivo</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2" style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap', gap: 8 }}>
                      <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => startEdit(record)} disabled={busyId === record.id}>
                        <Pencil size={13} />
                        Editar
                      </button>
                      {record.active ? (
                        <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13, color: '#ef4444' }} onClick={() => toggleActive(record)} disabled={busyId === record.id}>
                          <Ban size={13} />
                          Desactivar
                        </button>
                      ) : (
                        <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13, color: '#10b981' }} onClick={() => toggleActive(record)} disabled={busyId === record.id}>
                          <CheckCircle2 size={13} />
                          Activar
                        </button>
                      )}
                      <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13, color: '#ef4444' }} onClick={() => removeCircuit(record)} disabled={busyId === record.id} title="Eliminar (solo si no tiene solicitudes)">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

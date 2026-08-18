'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { Ban, CheckCircle2, Languages, Pencil, Plus, Trash2 } from 'lucide-react'
import { touristCircuitIconOptions, type TouristCircuitRecord } from '@/lib/tourist-circuits'

interface CircuitFormState {
  name: string
  schedule: string
  duration: string
  summary: string
  description: string
  highlightsText: string
  icon: string
  sortOrder: string
  defaultCapacity: string
  defaultMeetingPoint: string
}

const emptyCircuitForm: CircuitFormState = {
  name: '',
  schedule: '',
  duration: '',
  summary: '',
  description: '',
  highlightsText: '',
  icon: 'bus',
  sortOrder: '',
  defaultCapacity: '',
  defaultMeetingPoint: '',
}

function recordToForm(record: TouristCircuitRecord): CircuitFormState {
  return {
    name: record.name_es || '',
    schedule: record.schedule_es || '',
    duration: record.duration_es || '',
    summary: record.summary_es || '',
    description: record.description_es || '',
    highlightsText: (record.highlights_es || []).join('\n'),
    icon: record.icon,
    sortOrder: String(record.sort_order ?? ''),
    defaultCapacity: record.default_capacity ? String(record.default_capacity) : '',
    defaultMeetingPoint: record.default_meeting_point || '',
  }
}

function formToPayload(form: CircuitFormState, extra: Record<string, unknown> = {}) {
  return {
    name: form.name,
    schedule: form.schedule,
    duration: form.duration,
    summary: form.summary,
    description: form.description,
    highlights: form.highlightsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    icon: form.icon,
    sortOrder: form.sortOrder === '' ? null : Number(form.sortOrder),
    defaultCapacity: form.defaultCapacity === '' ? null : Number(form.defaultCapacity),
    defaultMeetingPoint: form.defaultMeetingPoint,
    ...extra,
  }
}

export function TouristCircuitsPanel({
  records,
  aiConfigured,
  loading,
  loadError,
  onChanged,
}: {
  records: TouristCircuitRecord[]
  aiConfigured: boolean
  loading: boolean
  loadError: string | null
  onChanged: () => void
}) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CircuitFormState>(emptyCircuitForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const updateForm = (field: keyof CircuitFormState) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const startCreate = () => {
    setEditingId(null)
    setForm(emptyCircuitForm)
    setFormErrors({})
    setShowForm(true)
  }

  const startEdit = (record: TouristCircuitRecord) => {
    setEditingId(record.id)
    setForm(recordToForm(record))
    setFormErrors({})
    setShowForm(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    setFormErrors({})
    try {
      const url = editingId ? `/api/admin/tourist-circuits/${editingId}` : '/api/admin/tourist-circuits'
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
      const translatedNote = result.translated
        ? ' Traducción al inglés generada automáticamente.'
        : aiConfigured
          ? ''
          : ' Sin traducción al inglés (falta configurar OPENROUTER_API_KEY): se mostrará en español.'
      setFeedback(`Circuito ${editingId ? 'actualizado' : 'creado'} correctamente.${translatedNote}`)
      setShowForm(false)
      setEditingId(null)
      setForm(emptyCircuitForm)
      onChanged()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar el circuito.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (record: TouristCircuitRecord) => {
    setBusyId(record.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/tourist-circuits/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleActive: true }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el circuito.')
      setFeedback(record.active ? 'Circuito desactivado: ya no aparece en la página pública.' : 'Circuito activado.')
      onChanged()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar el circuito.')
    } finally {
      setBusyId(null)
    }
  }

  const retranslate = async (record: TouristCircuitRecord) => {
    setBusyId(record.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/tourist-circuits/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(recordToForm(record), { retranslate: true, active: record.active })),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo retraducir el circuito.')
      setFeedback(result.translated ? 'Traducción al inglés actualizada.' : 'No se pudo generar la traducción. Revisá OPENROUTER_API_KEY.')
      onChanged()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo retraducir el circuito.')
    } finally {
      setBusyId(null)
    }
  }

  const removeCircuit = async (record: TouristCircuitRecord) => {
    if (!window.confirm(`¿Eliminar el circuito "${record.name_es}"? Esta acción no se puede deshacer.`)) return
    setBusyId(record.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/tourist-circuits/${record.id}`, { method: 'DELETE' })
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
    <>
      {!aiConfigured && !loading ? (
        <div className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', marginBottom: 14 }}>
          Traducción automática no configurada (falta OPENROUTER_API_KEY): los circuitos nuevos se mostrarán en español también en la versión en inglés.
        </div>
      ) : null}

      {feedback ? (
        <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)', marginBottom: 14 }}>
          {feedback}
        </div>
      ) : null}

      <div className="table-container" style={{ marginBottom: 20 }}>
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <span className="td-muted" style={{ fontSize: 13 }}>
            Catálogo exclusivo del <strong>bus turístico</strong> (no afecta al bus educativo). Los circuitos activos aparecen en la página pública y en el selector de nuevas salidas.
          </span>
          <button className="btn btn-primary" onClick={startCreate}>
            <Plus size={14} />
            Nuevo circuito
          </button>
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit} style={{ padding: '4px 16px 18px' }}>
            <h3 style={{ margin: '10px 0 14px' }}>{editingId ? 'Editar circuito' : 'Nuevo circuito'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <label style={fieldStyle}>
                Nombre *
                <input className="input" value={form.name} onChange={(event) => updateForm('name')(event.target.value)} placeholder="Ej. Circuito con Acento Francés" />
                {formErrors.name ? <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.name}</span> : null}
              </label>
              <label style={fieldStyle}>
                Días y horarios
                <input className="input" value={form.schedule} onChange={(event) => updateForm('schedule')(event.target.value)} placeholder="Ej. Sábados · 17:00 h" />
              </label>
              <label style={fieldStyle}>
                Duración
                <input className="input" value={form.duration} onChange={(event) => updateForm('duration')(event.target.value)} placeholder="Ej. 2 horas" />
              </label>
              <label style={fieldStyle}>
                Ícono
                <select className="select" value={form.icon} onChange={(event) => updateForm('icon')(event.target.value)}>
                  {touristCircuitIconOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>
                Cupo por defecto
                <input type="number" min={1} max={500} className="input" value={form.defaultCapacity} onChange={(event) => updateForm('defaultCapacity')(event.target.value)} placeholder="Ej. 40" />
                {formErrors.defaultCapacity ? <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.defaultCapacity}</span> : null}
              </label>
              <label style={fieldStyle}>
                Punto de encuentro por defecto
                <input className="input" value={form.defaultMeetingPoint} onChange={(event) => updateForm('defaultMeetingPoint')(event.target.value)} placeholder="Ej. Plaza Independencia" />
              </label>
              <label style={fieldStyle}>
                Orden en la página
                <input type="number" min={0} className="input" value={form.sortOrder} onChange={(event) => updateForm('sortOrder')(event.target.value)} placeholder="Menor = primero" />
              </label>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              <label style={fieldStyle}>
                Resumen (una línea para la tarjeta)
                <input className="input" value={form.summary} onChange={(event) => updateForm('summary')(event.target.value)} placeholder="Ej. Historia y sabores de la ciudad en un recorrido guiado." />
              </label>
              <label style={fieldStyle}>
                Descripción
                <textarea className="input" style={{ minHeight: 70, padding: '8px 12px' }} value={form.description} onChange={(event) => updateForm('description')(event.target.value)} />
              </label>
              <label style={fieldStyle}>
                Qué incluye el recorrido (un punto por línea)
                <textarea className="input" style={{ minHeight: 90, padding: '8px 12px' }} value={form.highlightsText} onChange={(event) => updateForm('highlightsText')(event.target.value)} placeholder={'Plaza Independencia\nMuseo Casa Padilla\n...'} />
              </label>
            </div>
            <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear circuito'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              {aiConfigured ? (
                <span className="td-muted" style={{ fontSize: 12 }}>
                  Al guardar se genera la traducción al inglés automáticamente.
                </span>
              ) : null}
            </div>
          </form>
        ) : null}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Circuito</th>
                <th>Orden</th>
                <th>Cupo por defecto</th>
                <th>Inglés</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="loading-state">
                      <div className="spinner" />
                      Cargando circuitos...
                    </div>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <p>{loadError}</p>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <p>No hay circuitos cargados todavía.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="td-text-primary">{record.name_es}</div>
                      {record.summary_es ? <div className="td-muted">{record.summary_es}</div> : null}
                    </td>
                    <td>{record.sort_order}</td>
                    <td>{record.default_capacity ?? '—'}</td>
                    <td>
                      {record.name_en ? (
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Traducido</span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(245,158,11,0.18)', color: '#f59e0b' }}>Falta</span>
                      )}
                    </td>
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
                        {aiConfigured ? (
                          <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => retranslate(record)} disabled={busyId === record.id} title="Regenerar traducción al inglés">
                            <Languages size={13} />
                          </button>
                        ) : null}
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
                        <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13, color: '#ef4444' }} onClick={() => removeCircuit(record)} disabled={busyId === record.id} title="Eliminar (solo si no tiene salidas)">
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
    </>
  )
}

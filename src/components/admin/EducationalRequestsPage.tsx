'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  formatDateToDisplay,
  getCircuitLabel,
  getInstitutionTypeLabel,
  getMonthBounds,
  getMonthCalendarMatrix,
  getMonthLabel,
  getRequestStatusLabel,
  getShiftLabel,
  getTodayDateStringInBuenosAires,
  institutionTypeOptions,
  parseBusinessDateParts,
  preferredShiftOptions,
  requestStatusOptions,
  type EducationalBusRequest,
  type EducationalBusRequestFilters,
  type EducationalBusRequestStatus,
  type EducationalSettings,
} from '@/lib/educational-bus-requests'
import { Bus, CalendarDays, ChevronLeft, ChevronRight, Download, Eye, Filter, List, Mail, MessageCircle, Plus, RefreshCw, Search, Settings } from 'lucide-react'
import { EducationalCircuitsPanel } from './EducationalCircuitsPanel'
import type { EducationalCircuitRecord } from '@/lib/educational-circuits'

// Carga manual de turnos tomados por teléfono/presencial (reemplaza al Excel).
function ManualRequestPanel({
  circuits,
  onCreated,
}: {
  circuits: EducationalCircuitRecord[]
  onCreated: () => void
}) {
  const emptyForm = {
    circuit: '',
    requestedDate: '',
    preferredShift: 'manana',
    institutionName: '',
    institutionType: 'provincial',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    studentCount: '',
    notes: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const activeCircuits = circuits.filter((circuit) => circuit.active)

  const update = (field: keyof typeof emptyForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    setFieldErrors({})
    try {
      const response = await fetch('/api/admin/educational-bus-requests/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        throw new Error(result.error || 'No se pudo cargar el turno.')
      }
      setFeedback(`Turno cargado y aprobado: ${result.data.institution_name} — ${result.data.requested_date} (${result.data.preferred_shift === 'manana' ? 'mañana' : 'tarde'}). El calendario público ya lo muestra ocupado.`)
      setForm((current) => ({ ...emptyForm, circuit: current.circuit }))
      onCreated()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cargar el turno.')
    } finally {
      setSaving(false)
    }
  }

  const fieldStyle = { display: 'grid', gap: 6, fontSize: 13 } as const

  return (
    <div className="table-container" style={{ marginBottom: 20, padding: 18 }}>
      <h3 style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Plus size={16} />
        Cargar turno manual
      </h3>
      <p className="td-muted" style={{ marginBottom: 14, fontSize: 13 }}>
        Para turnos tomados por teléfono o en persona. Queda <strong>aprobado al instante</strong> y bloquea ese día y turno en el calendario público — chau planilla de Excel 😉.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <label style={fieldStyle}>
            Circuito
            <select className="select" value={form.circuit} onChange={(event) => update('circuit')(event.target.value)}>
              <option value="">Histórico Cultural (por defecto)</option>
              {activeCircuits.map((circuit) => (
                <option key={circuit.slug} value={circuit.slug}>
                  {circuit.name}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            Fecha *
            <input type="date" className="input" value={form.requestedDate} onChange={(event) => update('requestedDate')(event.target.value)} />
            {fieldErrors.requestedDate ? <span style={{ color: '#ef4444', fontSize: 12 }}>{fieldErrors.requestedDate}</span> : null}
          </label>
          <label style={fieldStyle}>
            Turno *
            <select className="select" value={form.preferredShift} onChange={(event) => update('preferredShift')(event.target.value)}>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </label>
          <label style={fieldStyle}>
            Institución *
            <input className="input" value={form.institutionName} onChange={(event) => update('institutionName')(event.target.value)} placeholder="Ej. Esc. Sec. B° Los Pinos" />
            {fieldErrors.institutionName ? <span style={{ color: '#ef4444', fontSize: 12 }}>{fieldErrors.institutionName}</span> : null}
          </label>
          <label style={fieldStyle}>
            Tipo
            <select className="select" value={form.institutionType} onChange={(event) => update('institutionType')(event.target.value)}>
              <option value="municipal">Escuela municipal</option>
              <option value="provincial">Escuela provincial</option>
              <option value="private">Institución privada</option>
            </select>
          </label>
          <label style={fieldStyle}>
            Contacto
            <input className="input" value={form.contactName} onChange={(event) => update('contactName')(event.target.value)} placeholder="Ej. Rita Lindon" />
          </label>
          <label style={fieldStyle}>
            Teléfono
            <input className="input" value={form.contactPhone} onChange={(event) => update('contactPhone')(event.target.value)} placeholder="3810000000" />
            {fieldErrors.contactPhone ? <span style={{ color: '#ef4444', fontSize: 12 }}>{fieldErrors.contactPhone}</span> : null}
          </label>
          <label style={fieldStyle}>
            Email (opcional)
            <input className="input" value={form.contactEmail} onChange={(event) => update('contactEmail')(event.target.value)} placeholder="escuela@edu.ar" />
          </label>
          <label style={fieldStyle}>
            Alumnos (opcional)
            <input type="number" min={1} max={200} className="input" value={form.studentCount} onChange={(event) => update('studentCount')(event.target.value)} placeholder="30" />
            {fieldErrors.studentCount ? <span style={{ color: '#ef4444', fontSize: 12 }}>{fieldErrors.studentCount}</span> : null}
          </label>
        </div>
        <label style={{ ...fieldStyle, marginTop: 12 }}>
          Observaciones (quién confirmó, aclaraciones)
          <input className="input" value={form.notes} onChange={(event) => update('notes')(event.target.value)} placeholder="Ej. Confirmado por Rita el 27/8" />
        </label>

        {feedback ? (
          <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)', marginTop: 12 }}>
            {feedback}
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Cargando...' : 'Cargar turno aprobado'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EducationalSettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<EducationalSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/educational-settings', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'No se pudo cargar la configuración.')
        if (!cancelled) setSettings(result.data)
      })
      .catch((error) => {
        if (!cancelled) setFeedback(error instanceof Error ? error.message : 'No se pudo cargar la configuración.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/educational-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la configuración.')
      setSettings(result.data)
      setFeedback('Configuración guardada. Los cambios impactan al instante en la página pública.')
      onSaved()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="table-container" style={{ marginBottom: 20, padding: 18 }}>
      <h3 style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={16} />
        Configuración del bus educativo
      </h3>
      <p className="td-muted" style={{ marginBottom: 14, fontSize: 13 }}>
        Solo aplica al <strong>bus educativo</strong>. Bloqueo temporal de reservas y tamaño de los grupos; los días y turnos de cada circuito se definen en la pestaña Circuitos.
      </p>

      {loading ? (
        <div className="loading-state" style={{ padding: 12 }}>
          <div className="spinner" />
          Cargando configuración...
        </div>
      ) : settings ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Bloquear reservas hasta (inclusive)
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="input"
                  value={settings.blockedUntil || ''}
                  onChange={(event) =>
                    setSettings((current) => (current ? { ...current, blockedUntil: event.target.value || null } : current))
                  }
                />
                {settings.blockedUntil ? (
                  <button
                    className="btn btn-secondary"
                    style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                    onClick={() => setSettings((current) => (current ? { ...current, blockedUntil: null } : current))}
                  >
                    Quitar bloqueo
                  </button>
                ) : (
                  <span className="td-muted" style={{ fontSize: 12 }}>Sin bloqueo activo</span>
                )}
              </div>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Mínimo de alumnos
              <input
                type="number"
                min={1}
                className="input"
                value={settings.minStudents}
                onChange={(event) =>
                  setSettings((current) => (current ? { ...current, minStudents: Number(event.target.value) } : current))
                }
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Máximo de alumnos
              <input
                type="number"
                min={1}
                className="input"
                value={settings.maxStudents}
                onChange={(event) =>
                  setSettings((current) => (current ? { ...current, maxStudents: Number(event.target.value) } : current))
                }
              />
            </label>
          </div>

          {feedback ? (
            <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)', marginTop: 12 }}>
              {feedback}
            </div>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </>
      ) : (
        <p className="td-muted">{feedback || 'No se pudo cargar la configuración.'}</p>
      )}
    </div>
  )
}

type ViewMode = 'table' | 'calendar'

function buildQuery(filters: EducationalBusRequestFilters) {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  if (filters.preferredShift) params.set('preferredShift', filters.preferredShift)
  if (filters.institutionType) params.set('institutionType', filters.institutionType)
  if (filters.requestedDate) params.set('requestedDate', filters.requestedDate)
  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

function buildMonthKey(year: number, month: number) {
  return `${year}-${`${month}`.padStart(2, '0')}`
}

function getMonthParts(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}

function shiftMonthKey(monthKey: string, offset: number) {
  const parts = getMonthParts(monthKey)
  if (!parts) return monthKey
  const shifted = new Date(parts.year, parts.month - 1 + offset, 1)
  return buildMonthKey(shifted.getFullYear(), shifted.getMonth() + 1)
}

function StatusPill({ status }: { status: EducationalBusRequestStatus }) {
  const tone =
    status === 'approved'
      ? { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }
      : status === 'rejected'
        ? { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
        : { background: 'rgba(245, 158, 11, 0.18)', color: '#f59e0b' }

  return (
    <span className="badge" style={tone}>
      {getRequestStatusLabel(status)}
    </span>
  )
}

function getShiftTone(shift: EducationalBusRequest['preferred_shift']) {
  return shift === 'manana'
    ? { background: 'rgba(14, 165, 233, 0.16)', color: '#38bdf8' }
    : { background: 'rgba(168, 85, 247, 0.16)', color: '#c084fc' }
}

function toWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('54')) {
    return `https://wa.me/${digits}`
  }

  return `https://wa.me/54${digits.startsWith('0') ? digits.slice(1) : digits}`
}

function CalendarCard({
  dayNumber,
  dateKey,
  isCurrentMonth,
  events,
  selected,
  onSelect,
}: {
  dayNumber: number
  dateKey: string
  isCurrentMonth: boolean
  events: EducationalBusRequest[]
  selected: boolean
  onSelect: (dateKey: string) => void
}) {
  return (
    <button
      type="button"
      className={`calendar-day-card ${selected ? 'selected' : ''} ${isCurrentMonth ? '' : 'is-outside'}`.trim()}
      onClick={() => onSelect(dateKey)}
    >
      <div className="calendar-day-header">
        <span className="calendar-day-number">{`${dayNumber}`.padStart(2, '0')}</span>
        {events.length > 0 ? <span className="calendar-day-count">{events.length}</span> : null}
      </div>
      <div className="calendar-event-stack">
        {events.slice(0, 3).map((event) => (
          <div key={event.id} className="calendar-event-pill" style={getShiftTone(event.preferred_shift)}>
            <span>{getShiftLabel(event.preferred_shift)}</span>
            <span className="calendar-event-name">{event.institution_name}</span>
          </div>
        ))}
        {events.length > 3 ? <span className="calendar-more">+{events.length - 3} más</span> : null}
      </div>
    </button>
  )
}

export default function EducationalRequestsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const todayKey = useMemo(() => getTodayDateStringInBuenosAires(), [])
  const todayParts = useMemo(() => parseBusinessDateParts(todayKey), [todayKey])
  const initialMonthKey = useMemo(() => {
    if (!todayParts) return buildMonthKey(new Date().getFullYear(), new Date().getMonth() + 1)
    return buildMonthKey(todayParts.year, todayParts.month)
  }, [todayParts])
  const initialMonthBounds = useMemo(() => getMonthBounds(initialMonthKey), [initialMonthKey])

  const [filters, setFilters] = useState<EducationalBusRequestFilters>({})
  const [requests, setRequests] = useState<EducationalBusRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [currentMonthKey, setCurrentMonthKey] = useState(initialMonthKey)
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [exportFrom, setExportFrom] = useState(initialMonthBounds?.startDate || todayKey)
  const [exportTo, setExportTo] = useState(initialMonthBounds?.endDate || todayKey)
  const [exporting, setExporting] = useState(false)
  const [exportFeedback, setExportFeedback] = useState<string | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showCircuits, setShowCircuits] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [circuitRecords, setCircuitRecords] = useState<EducationalCircuitRecord[]>([])
  const [circuitsLoading, setCircuitsLoading] = useState(true)
  const [circuitsError, setCircuitsError] = useState<string | null>(null)

  const fetchCircuits = useCallback(async () => {
    setCircuitsLoading(true)
    setCircuitsError(null)
    try {
      const response = await fetch('/api/admin/educational-circuits', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los circuitos educativos.')
      setCircuitRecords(result.data || [])
    } catch (error) {
      setCircuitRecords([])
      setCircuitsError(error instanceof Error ? error.message : 'No se pudieron cargar los circuitos educativos.')
    } finally {
      setCircuitsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCircuits()
  }, [fetchCircuits])

  const circuitLabels = useMemo(
    () =>
      circuitRecords.reduce<Record<string, string>>((acc, record) => {
        acc[record.slug] = record.name
        return acc
      }, {}),
    [circuitRecords],
  )

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/educational-bus-requests${buildQuery(filters)}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las solicitudes.')
      setRequests(result.data || [])
    } catch (error) {
      console.error(error)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    if (params.get('saved') !== '1') return

    setSaveFeedback('Solicitud actualizada correctamente.')
    params.delete('saved')
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [pathname, router])

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((request) => request.status === 'pending').length,
      approved: requests.filter((request) => request.status === 'approved').length,
      rejected: requests.filter((request) => request.status === 'rejected').length,
    }
  }, [requests])

  const requestsByDate = useMemo(() => {
    return requests.reduce<Record<string, EducationalBusRequest[]>>((acc, request) => {
      if (!acc[request.requested_date]) acc[request.requested_date] = []
      acc[request.requested_date].push(request)
      return acc
    }, {})
  }, [requests])

  const calendarWeeks = useMemo(() => getMonthCalendarMatrix(currentMonthKey), [currentMonthKey])

  const currentMonthDate = useMemo(() => {
    const parts = getMonthParts(currentMonthKey)
    if (!parts) return new Date()
    return new Date(parts.year, parts.month - 1, 1)
  }, [currentMonthKey])

  useEffect(() => {
    const monthPrefix = `${currentMonthKey}-`
    const requestsInMonth = requests
      .filter((request) => request.requested_date.startsWith(monthPrefix))
      .sort((left, right) => left.requested_date.localeCompare(right.requested_date, 'es'))

    let nextSelectedDate = selectedDate

    if (!selectedDate.startsWith(monthPrefix)) {
      nextSelectedDate = todayKey.startsWith(monthPrefix)
        ? todayKey
        : requestsInMonth[0]?.requested_date || `${currentMonthKey}-01`
    }

    if (nextSelectedDate !== selectedDate) {
      setSelectedDate(nextSelectedDate)
    }
  }, [currentMonthKey, requests, selectedDate, todayKey])

  const selectedDayRequests = useMemo(() => {
    if (!selectedDate) return []
    return [...(requestsByDate[selectedDate] || [])].sort((left, right) => {
      if (left.preferred_shift !== right.preferred_shift) {
        return left.preferred_shift === 'manana' ? -1 : 1
      }
      return left.institution_name.localeCompare(right.institution_name, 'es')
    })
  }, [requestsByDate, selectedDate])

  const handleExportApproved = async () => {
    if (!exportFrom || !exportTo) {
      setExportFeedback('Seleccioná el rango de fechas para exportar.')
      return
    }

    if (exportFrom > exportTo) {
      setExportFeedback('La fecha desde no puede ser mayor que la fecha hasta.')
      return
    }

    setExporting(true)
    setExportFeedback(null)

    try {
      const response = await fetch(`/api/educational-bus-requests/export?from=${encodeURIComponent(exportFrom)}&to=${encodeURIComponent(exportTo)}`)
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'No se pudo exportar el archivo.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `buses-educativos-aprobados-${formatDateToDisplay(exportFrom)}-a-${formatDateToDisplay(exportTo)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setExportFeedback('Exportación generada correctamente.')
    } catch (error) {
      setExportFeedback(error instanceof Error ? error.message : 'No se pudo exportar el archivo.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Bus Educativo</h2>
          <p>Solicitudes, circuitos y configuración del bus educativo. Separado del bus turístico.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`btn ${showManual ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowManual((current) => !current)}>
            <Plus size={14} />
            Cargar turno
          </button>
          <button className={`btn ${showCircuits ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowCircuits((current) => !current)}>
            <Bus size={14} />
            Circuitos
          </button>
          <button className={`btn ${showSettings ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowSettings((current) => !current)}>
            <Settings size={14} />
            Configuración
          </button>
          <button className="btn btn-secondary" onClick={fetchRequests} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 0.6s linear infinite' } : {}} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="page-body">
        {showManual ? <ManualRequestPanel circuits={circuitRecords} onCreated={fetchRequests} /> : null}
        {showCircuits ? (
          <EducationalCircuitsPanel
            records={circuitRecords}
            loading={circuitsLoading}
            loadError={circuitsError}
            onChanged={fetchCircuits}
          />
        ) : null}
        {showSettings ? <EducationalSettingsPanel onSaved={fetchRequests} /> : null}
        {saveFeedback ? (
          <div className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', marginBottom: 16 }}>
            {saveFeedback}
          </div>
        ) : null}

        <div className="stats-grid">
          <div className="stat-card" style={{ '--card-color': '#0ea5e9', '--card-color-bg': 'rgba(14,165,233,0.15)' } as CSSProperties}>
            <div className="card-icon">ALL</div>
            <div className="card-value">{stats.total}</div>
            <div className="card-label">Total</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#f59e0b', '--card-color-bg': 'rgba(245,158,11,0.15)' } as CSSProperties}>
            <div className="card-icon">P</div>
            <div className="card-value">{stats.pending}</div>
            <div className="card-label">Pendientes</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#10b981', '--card-color-bg': 'rgba(16,185,129,0.15)' } as CSSProperties}>
            <div className="card-icon">OK</div>
            <div className="card-value">{stats.approved}</div>
            <div className="card-label">Aprobadas</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#ef4444', '--card-color-bg': 'rgba(239,68,68,0.15)' } as CSSProperties}>
            <div className="card-icon">NO</div>
            <div className="card-value">{stats.rejected}</div>
            <div className="card-label">Rechazadas</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-toolbar">
            <div className="flex items-center gap-2" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', height: 36, flex: 1, minWidth: 160 }}>
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                className="input"
                style={{ border: 'none', background: 'transparent', padding: 0, height: 'auto', flex: 1 }}
                placeholder="Buscar por institución o responsable..."
                value={filters.search || ''}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select className="select" value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as EducationalBusRequestFilters['status'] }))}>
              <option value="">Todos los estados</option>
              {requestStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className="select" value={filters.preferredShift || ''} onChange={(event) => setFilters((current) => ({ ...current, preferredShift: event.target.value as EducationalBusRequestFilters['preferredShift'] }))}>
              <option value="">Todos los turnos</option>
              {preferredShiftOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className="select" value={filters.institutionType || ''} onChange={(event) => setFilters((current) => ({ ...current, institutionType: event.target.value as EducationalBusRequestFilters['institutionType'] }))}>
              <option value="">Todas las instituciones</option>
              {institutionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input type="date" className="input" value={filters.requestedDate || ''} onChange={(event) => setFilters((current) => ({ ...current, requestedDate: event.target.value }))} />
          </div>

          <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
            <div className="view-toggle-group">
              <button className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('table')}>
                <List size={14} />
                Tabla
              </button>
              <button className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('calendar')}>
                <CalendarDays size={14} />
                Calendario
              </button>
            </div>

            {viewMode === 'calendar' ? (
              <div className="calendar-toolbar">
                <button className="btn btn-secondary btn-icon" onClick={() => setCurrentMonthKey((current) => shiftMonthKey(current, -1))}>
                  <ChevronLeft size={14} />
                </button>
                <strong className="calendar-month-label">{getMonthLabel(currentMonthDate)}</strong>
                <button className="btn btn-secondary btn-icon" onClick={() => setCurrentMonthKey((current) => shiftMonthKey(current, 1))}>
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <input type="date" className="input" value={exportFrom} onChange={(event) => setExportFrom(event.target.value)} style={{ width: 150 }} />
                <input type="date" className="input" value={exportTo} onChange={(event) => setExportTo(event.target.value)} style={{ width: 150 }} />
                <button className="btn btn-primary" onClick={handleExportApproved} disabled={exporting}>
                  <Download size={14} />
                  {exporting ? 'Exportando...' : 'Exportar aprobadas'}
                </button>
              </div>
            )}
          </div>

          {exportFeedback ? (
            <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)', margin: '0 16px 12px' }}>
              {exportFeedback}
            </div>
          ) : null}

          {viewMode === 'table' ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Institución</th>
                    <th>Responsable</th>
                    <th>Fecha</th>
                    <th>Turno</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="loading-state">
                          <div className="spinner" />
                          Cargando solicitudes...
                        </div>
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <div className="icon">?</div>
                          <p>No hay solicitudes para los filtros seleccionados.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    requests.map((request) => (
                      <tr key={request.id}>
                        <td>
                          <div className="td-text-primary">{request.institution_name}</div>
                          <div className="td-muted">{request.student_count} alumnos · {getCircuitLabel(request.circuit, circuitLabels)}</div>
                          {request.guides ? <div className="td-muted">Guías: {request.guides}</div> : null}
                        </td>
                        <td>
                          <div className="td-text-primary">{request.contact_name}</div>
                          <div className="td-muted">{request.contact_email}</div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <CalendarDays size={14} />
                            {formatDateToDisplay(request.requested_date)}
                          </div>
                        </td>
                        <td>{getShiftLabel(request.preferred_shift)}</td>
                        <td>{getInstitutionTypeLabel(request.institution_type)}</td>
                        <td>
                          <StatusPill status={request.status} />
                        </td>
                        <td>
                          <div className="flex items-center gap-2" style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap', gap: 8 }}>
                            <a href={`mailto:${request.contact_email}`} className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13 }}>
                              <Mail size={14} />
                              Mail
                            </a>
                            {toWhatsAppLink(request.contact_phone) ? (
                              <a
                                href={toWhatsAppLink(request.contact_phone) || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary"
                                style={{ height: 32, padding: '0 10px', fontSize: 13 }}
                              >
                                <MessageCircle size={14} />
                                WhatsApp
                              </a>
                            ) : null}
                            {request.attachment_path && !request.attachment_path.startsWith('migracion/') ? (
                              <a href={`/api/educational-bus-requests/${request.id}/attachment`} className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13 }}>
                                <Download size={14} />
                                Adjunto
                              </a>
                            ) : null}
                            <Link href={`/admin/solicitudes/${request.id}`} className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13 }}>
                              <Eye size={14} />
                              Ver detalle
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="calendar-layout">
              <div className="calendar-panel">
                <div className="calendar-weekdays">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="calendar-grid">
                  {calendarWeeks.flat().map((day) => (
                    <CalendarCard
                      key={day.dateKey}
                      dayNumber={day.dayNumber}
                      dateKey={day.dateKey}
                      isCurrentMonth={day.isCurrentMonth}
                      events={requestsByDate[day.dateKey] || []}
                      selected={selectedDate === day.dateKey}
                      onSelect={setSelectedDate}
                    />
                  ))}
                </div>
              </div>

              <aside className="calendar-sidebar">
                <div className="calendar-sidebar-header">
                  <h3>Reservas del día</h3>
                  <p>{selectedDate ? formatDateToDisplay(selectedDate) : 'Selecciona una fecha'}</p>
                </div>

                {selectedDayRequests.length === 0 ? (
                  <div className="empty-state" style={{ padding: 24 }}>
                    <div className="icon">?</div>
                    <p>No hay reservas para el día seleccionado.</p>
                  </div>
                ) : (
                  <div className="calendar-sidebar-list">
                    {selectedDayRequests.map((request) => (
                      <div key={request.id} className="calendar-reservation-card">
                        <div className="flex items-center gap-2" style={{ justifyContent: 'space-between' }}>
                          <span className="badge" style={getShiftTone(request.preferred_shift)}>
                            {getShiftLabel(request.preferred_shift)}
                          </span>
                          <StatusPill status={request.status} />
                        </div>
                        <p className="td-text-primary" style={{ marginTop: 12 }}>{request.institution_name}</p>
                        <p className="td-muted">{request.contact_name}</p>
                        <p className="td-muted">{getInstitutionTypeLabel(request.institution_type)}</p>
                        {request.guides ? <p className="td-muted">Guías: {request.guides}</p> : null}
                        <Link href={`/admin/solicitudes/${request.id}`} className="btn btn-secondary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>
                          <Eye size={14} />
                          Abrir detalle
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

'use client'

import type { CSSProperties, FormEvent } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Ban,
  Bus,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import {
  formatDateToDisplay,
  formatDateTimeToDisplay,
  getMonthBounds,
  getTodayDateStringInBuenosAires,
} from '@/lib/educational-bus-requests'
import {
  formatDepartureTime,
  getDepartureOccupancyPercent,
  type TouristBooking,
  type TouristDepartureAvailability,
} from '@/lib/tourist-bus'
import { touristCircuitCatalog } from '@/lib/tourist-circuits'

type Scope = 'upcoming' | 'past' | 'all'

const customCircuitValue = '__custom__'

interface NewDepartureForm {
  circuitSlug: string
  title: string
  departureDate: string
  departureTime: string
  capacity: string
  meetingPoint: string
  notes: string
}

const initialNewDeparture: NewDepartureForm = {
  circuitSlug: touristCircuitCatalog[0]?.slug || customCircuitValue,
  title: '',
  departureDate: '',
  departureTime: '16:00',
  capacity: '40',
  meetingPoint: 'Plaza Independencia (calle Laprida)',
  notes: '',
}

function toWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('54')) return `https://wa.me/${digits}`
  return `https://wa.me/54${digits.startsWith('0') ? digits.slice(1) : digits}`
}

function DeparturePill({ departure, todayKey }: { departure: TouristDepartureAvailability; todayKey: string }) {
  const isPast = departure.departure_date < todayKey
  const tone =
    departure.status === 'cancelled'
      ? { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }
      : isPast
        ? { background: 'rgba(148, 163, 184, 0.18)', color: '#94a3b8' }
        : { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }
  const label = departure.status === 'cancelled' ? 'Cancelada' : isPast ? 'Finalizada' : 'Activa'

  return (
    <span className="badge" style={tone}>
      {label}
    </span>
  )
}

function BookingStatusPill({ status }: { status: TouristBooking['status'] }) {
  const tone =
    status === 'confirmed'
      ? { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }
      : { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }

  return (
    <span className="badge" style={tone}>
      {status === 'confirmed' ? 'Confirmada' : 'Cancelada'}
    </span>
  )
}

export default function TouristDeparturesPage() {
  const todayKey = useMemo(() => getTodayDateStringInBuenosAires(), [])
  const initialMonthBounds = useMemo(() => getMonthBounds(todayKey.slice(0, 7)), [todayKey])

  const [scope, setScope] = useState<Scope>('upcoming')
  const [departures, setDepartures] = useState<TouristDepartureAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDeparture, setNewDeparture] = useState<NewDepartureForm>(initialNewDeparture)
  const [creating, setCreating] = useState(false)
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [bookingsByDeparture, setBookingsByDeparture] = useState<Record<number, TouristBooking[]>>({})
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [capacityDrafts, setCapacityDrafts] = useState<Record<number, string>>({})
  const [exportFrom, setExportFrom] = useState(initialMonthBounds?.startDate || todayKey)
  const [exportTo, setExportTo] = useState(initialMonthBounds?.endDate || todayKey)
  const [exporting, setExporting] = useState(false)

  const fetchDepartures = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tourist-departures?scope=${scope}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las salidas.')
      setDepartures(result.data || [])
    } catch (error) {
      console.error(error)
      setDepartures([])
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    fetchDepartures()
  }, [fetchDepartures])

  const stats = useMemo(() => {
    const active = departures.filter((departure) => departure.status === 'active')
    return {
      total: departures.length,
      reserved: departures.reduce((total, departure) => total + departure.reserved, 0),
      remaining: active.reduce((total, departure) => total + departure.remaining, 0),
      cancelled: departures.filter((departure) => departure.status === 'cancelled').length,
    }
  }, [departures])

  const loadBookings = useCallback(async (departureId: number) => {
    setBookingsLoading(true)
    try {
      const response = await fetch(`/api/admin/tourist-departures/${departureId}/bookings`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las reservas.')
      setBookingsByDeparture((current) => ({ ...current, [departureId]: result.data || [] }))
    } catch (error) {
      console.error(error)
      setBookingsByDeparture((current) => ({ ...current, [departureId]: [] }))
    } finally {
      setBookingsLoading(false)
    }
  }, [])

  const toggleExpanded = (departureId: number) => {
    setExpandedId((current) => {
      const next = current === departureId ? null : departureId
      if (next !== null) void loadBookings(next)
      return next
    })
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)
    setCreateErrors({})
    setFeedback(null)
    try {
      const payload = {
        circuitSlug: newDeparture.circuitSlug === customCircuitValue ? '' : newDeparture.circuitSlug,
        title: newDeparture.title,
        departureDate: newDeparture.departureDate,
        departureTime: newDeparture.departureTime,
        capacity: Number(newDeparture.capacity),
        meetingPoint: newDeparture.meetingPoint,
        notes: newDeparture.notes,
      }
      const response = await fetch('/api/admin/tourist-departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) {
        if (result.fieldErrors) setCreateErrors(result.fieldErrors)
        throw new Error(result.error || 'No se pudo crear la salida.')
      }
      setFeedback('Salida creada correctamente.')
      setNewDeparture((current) => ({ ...initialNewDeparture, circuitSlug: current.circuitSlug }))
      setShowCreateForm(false)
      await fetchDepartures()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la salida.')
    } finally {
      setCreating(false)
    }
  }

  const patchDeparture = async (departureId: number, payload: Record<string, unknown>, successMessage: string) => {
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/tourist-departures/${departureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la salida.')
      setFeedback(successMessage)
      await fetchDepartures()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar la salida.')
    }
  }

  const deleteDeparture = async (departureId: number) => {
    if (!window.confirm('¿Eliminar esta salida? Esta acción no se puede deshacer.')) return
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/tourist-departures/${departureId}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo eliminar la salida.')
      setFeedback('Salida eliminada correctamente.')
      if (expandedId === departureId) setExpandedId(null)
      await fetchDepartures()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar la salida.')
    }
  }

  const updateBookingStatus = async (booking: TouristBooking, status: TouristBooking['status']) => {
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/tourist-bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la reserva.')
      setFeedback(status === 'cancelled' ? 'Reserva cancelada.' : 'Reserva reconfirmada.')
      await Promise.all([loadBookings(booking.departure_id), fetchDepartures()])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo actualizar la reserva.')
    }
  }

  const saveCapacity = async (departure: TouristDepartureAvailability) => {
    const draft = capacityDrafts[departure.id]
    const capacity = Number(draft)
    if (!draft || !Number.isInteger(capacity) || capacity < 1) {
      setFeedback('Ingresá un cupo válido.')
      return
    }
    if (capacity < departure.reserved) {
      setFeedback(`El cupo no puede ser menor a los ${departure.reserved} lugares ya reservados.`)
      return
    }
    await patchDeparture(departure.id, { capacity }, 'Cupo actualizado correctamente.')
  }

  const handleExport = async () => {
    setExporting(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/tourist-departures/export?from=${exportFrom}&to=${exportTo}`)
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error || 'No se pudo exportar el archivo.')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const disposition = response.headers.get('Content-Disposition') || ''
      const match = /filename="([^"]+)"/.exec(disposition)
      link.download = match?.[1] || 'reservas-bus-turistico.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setFeedback('Exportación generada correctamente.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo exportar el archivo.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Bus Turístico</h2>
          <p>Salidas programadas, cupos y reservas del bus turístico para el público general.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={fetchDepartures} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 0.6s linear infinite' } : {}} />
            Actualizar
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateForm((current) => !current)}>
            <Plus size={14} />
            Nueva salida
          </button>
        </div>
      </div>

      <div className="page-body">
        {feedback ? (
          <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)', marginBottom: 16 }}>
            {feedback}
          </div>
        ) : null}

        {showCreateForm ? (
          <div className="table-container" style={{ marginBottom: 20, padding: 18 }}>
            <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bus size={16} />
              Nueva salida
            </h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  Circuito
                  <select
                    className="select"
                    value={newDeparture.circuitSlug}
                    onChange={(event) => setNewDeparture((current) => ({ ...current, circuitSlug: event.target.value }))}
                  >
                    {touristCircuitCatalog.map((circuit) => (
                      <option key={circuit.slug} value={circuit.slug}>
                        {circuit.content.es.name}
                      </option>
                    ))}
                    <option value={customCircuitValue}>Otro circuito (personalizado)</option>
                  </select>
                </label>
                {newDeparture.circuitSlug === customCircuitValue ? (
                  <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                    Nombre de la salida
                    <input
                      className="input"
                      value={newDeparture.title}
                      onChange={(event) => setNewDeparture((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Ej. Circuito con Acento Francés"
                    />
                    {createErrors.title ? <span style={{ color: '#ef4444', fontSize: 12 }}>{createErrors.title}</span> : null}
                  </label>
                ) : null}
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  Fecha
                  <input
                    type="date"
                    className="input"
                    min={todayKey}
                    value={newDeparture.departureDate}
                    onChange={(event) => setNewDeparture((current) => ({ ...current, departureDate: event.target.value }))}
                  />
                  {createErrors.departureDate ? <span style={{ color: '#ef4444', fontSize: 12 }}>{createErrors.departureDate}</span> : null}
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  Hora
                  <input
                    type="time"
                    className="input"
                    value={newDeparture.departureTime}
                    onChange={(event) => setNewDeparture((current) => ({ ...current, departureTime: event.target.value }))}
                  />
                  {createErrors.departureTime ? <span style={{ color: '#ef4444', fontSize: 12 }}>{createErrors.departureTime}</span> : null}
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  Cupo
                  <input
                    type="number"
                    min={1}
                    max={500}
                    className="input"
                    value={newDeparture.capacity}
                    onChange={(event) => setNewDeparture((current) => ({ ...current, capacity: event.target.value }))}
                  />
                  {createErrors.capacity ? <span style={{ color: '#ef4444', fontSize: 12 }}>{createErrors.capacity}</span> : null}
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  Punto de encuentro
                  <input
                    className="input"
                    value={newDeparture.meetingPoint}
                    onChange={(event) => setNewDeparture((current) => ({ ...current, meetingPoint: event.target.value }))}
                    placeholder="Ej. Plaza Independencia"
                  />
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                  Notas (visibles al público)
                  <input
                    className="input"
                    value={newDeparture.notes}
                    onChange={(event) => setNewDeparture((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Ej. Traer gorra y agua"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creando...' : 'Crear salida'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="stats-grid">
          <div className="stat-card" style={{ '--card-color': '#0ea5e9', '--card-color-bg': 'rgba(14,165,233,0.15)' } as CSSProperties}>
            <div className="card-icon">
              <Bus size={18} />
            </div>
            <div className="card-value">{stats.total}</div>
            <div className="card-label">Salidas listadas</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#10b981', '--card-color-bg': 'rgba(16,185,129,0.15)' } as CSSProperties}>
            <div className="card-icon">OK</div>
            <div className="card-value">{stats.reserved}</div>
            <div className="card-label">Lugares reservados</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#f59e0b', '--card-color-bg': 'rgba(245,158,11,0.15)' } as CSSProperties}>
            <div className="card-icon">?</div>
            <div className="card-value">{stats.remaining}</div>
            <div className="card-label">Lugares disponibles</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#ef4444', '--card-color-bg': 'rgba(239,68,68,0.15)' } as CSSProperties}>
            <div className="card-icon">
              <Ban size={16} />
            </div>
            <div className="card-value">{stats.cancelled}</div>
            <div className="card-label">Canceladas</div>
          </div>
        </div>

        <div className="table-container">
          <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
            <select className="select" value={scope} onChange={(event) => setScope(event.target.value as Scope)} style={{ width: 180 }}>
              <option value="upcoming">Próximas salidas</option>
              <option value="past">Salidas pasadas</option>
              <option value="all">Todas</option>
            </select>

            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <input type="date" className="input" value={exportFrom} onChange={(event) => setExportFrom(event.target.value)} style={{ width: 150 }} />
              <input type="date" className="input" value={exportTo} onChange={(event) => setExportTo(event.target.value)} style={{ width: 150 }} />
              <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
                <Download size={14} />
                {exporting ? 'Exportando...' : 'Exportar reservas'}
              </button>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Salida</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Ocupación</th>
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
                        Cargando salidas...
                      </div>
                    </td>
                  </tr>
                ) : departures.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="icon">
                          <Bus size={18} />
                        </div>
                        <p>No hay salidas para el filtro seleccionado. Creá una con “Nueva salida”.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  departures.map((departure) => {
                    const isExpanded = expandedId === departure.id
                    const bookings = bookingsByDeparture[departure.id] || []
                    const occupancy = getDepartureOccupancyPercent(departure)

                    return (
                      <Fragment key={departure.id}>
                        <tr>
                          <td>
                            <div className="td-text-primary">{departure.title}</div>
                            {departure.meeting_point ? <div className="td-muted">{departure.meeting_point}</div> : null}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <CalendarDays size={14} />
                              {formatDateToDisplay(departure.departure_date)}
                            </div>
                          </td>
                          <td>{formatDepartureTime(departure.departure_time)} h</td>
                          <td>
                            <div className="td-text-primary">
                              {departure.reserved}/{departure.capacity} ({occupancy}%)
                            </div>
                            <div style={{ width: 120, height: 6, borderRadius: 999, background: 'rgba(148,163,184,0.25)', overflow: 'hidden', marginTop: 4 }}>
                              <div
                                style={{
                                  width: `${occupancy}%`,
                                  height: '100%',
                                  borderRadius: 999,
                                  background: occupancy >= 100 ? '#ef4444' : occupancy >= 75 ? '#f59e0b' : '#10b981',
                                }}
                              />
                            </div>
                          </td>
                          <td>
                            <DeparturePill departure={departure} todayKey={todayKey} />
                          </td>
                          <td>
                            <div className="flex items-center gap-2" style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap', gap: 8 }}>
                              <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => toggleExpanded(departure.id)}>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                Inscriptos ({departure.reserved})
                              </button>
                              {departure.status === 'active' ? (
                                <button
                                  className="btn btn-secondary"
                                  style={{ height: 32, padding: '0 10px', fontSize: 13, color: '#ef4444' }}
                                  onClick={() => patchDeparture(departure.id, { status: 'cancelled' }, 'Salida cancelada.')}
                                >
                                  <Ban size={14} />
                                  Cancelar
                                </button>
                              ) : (
                                <button
                                  className="btn btn-secondary"
                                  style={{ height: 32, padding: '0 10px', fontSize: 13, color: '#10b981' }}
                                  onClick={() => patchDeparture(departure.id, { status: 'active' }, 'Salida reactivada.')}
                                >
                                  <CheckCircle2 size={14} />
                                  Reactivar
                                </button>
                              )}
                              {departure.reserved === 0 ? (
                                <button
                                  className="btn btn-secondary"
                                  style={{ height: 32, padding: '0 10px', fontSize: 13, color: '#ef4444' }}
                                  onClick={() => deleteDeparture(departure.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td colSpan={6} style={{ background: 'rgba(148,163,184,0.06)' }}>
                              <div style={{ padding: '12px 6px', display: 'grid', gap: 14 }}>
                                <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: 13 }}>Editar cupo:</strong>
                                  <input
                                    type="number"
                                    min={departure.reserved || 1}
                                    max={500}
                                    className="input"
                                    style={{ width: 110 }}
                                    value={capacityDrafts[departure.id] ?? String(departure.capacity)}
                                    onChange={(event) =>
                                      setCapacityDrafts((current) => ({ ...current, [departure.id]: event.target.value }))
                                    }
                                  />
                                  <button className="btn btn-secondary" style={{ height: 32, padding: '0 12px', fontSize: 13 }} onClick={() => saveCapacity(departure)}>
                                    Guardar cupo
                                  </button>
                                  {departure.notes ? <span className="td-muted">Notas: {departure.notes}</span> : null}
                                </div>

                                {bookingsLoading && bookings.length === 0 ? (
                                  <div className="loading-state" style={{ padding: 12 }}>
                                    <div className="spinner" />
                                    Cargando reservas...
                                  </div>
                                ) : bookings.length === 0 ? (
                                  <p className="td-muted" style={{ padding: '4px 0' }}>
                                    Todavía no hay reservas para esta salida.
                                  </p>
                                ) : (
                                  <div className="table-scroll">
                                    <table>
                                      <thead>
                                        <tr>
                                          <th>Nombre</th>
                                          <th>Contacto</th>
                                          <th>Procedencia</th>
                                          <th>Personas</th>
                                          <th>Idioma</th>
                                          <th>Estado</th>
                                          <th>Reservada</th>
                                          <th>Acciones</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {bookings.map((booking) => (
                                          <tr key={booking.id}>
                                            <td>
                                              <div className="td-text-primary">{booking.full_name}</div>
                                            </td>
                                            <td>
                                              <div className="flex items-center gap-2" style={{ gap: 8 }}>
                                                <a href={`mailto:${booking.email}`} className="btn btn-secondary" style={{ height: 28, padding: '0 8px', fontSize: 12 }}>
                                                  <Mail size={12} />
                                                </a>
                                                {toWhatsAppLink(booking.phone) ? (
                                                  <a href={toWhatsAppLink(booking.phone) || '#'} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ height: 28, padding: '0 8px', fontSize: 12 }}>
                                                    <MessageCircle size={12} />
                                                  </a>
                                                ) : null}
                                                <span className="td-muted">{booking.phone}</span>
                                              </div>
                                            </td>
                                            <td>{booking.origin_city || '—'}</td>
                                            <td>{booking.people_count}</td>
                                            <td>{booking.language === 'en' ? 'EN' : 'ES'}</td>
                                            <td>
                                              <BookingStatusPill status={booking.status} />
                                            </td>
                                            <td className="td-muted">{formatDateTimeToDisplay(booking.created_at)}</td>
                                            <td>
                                              {booking.status === 'confirmed' ? (
                                                <button
                                                  className="btn btn-secondary"
                                                  style={{ height: 28, padding: '0 10px', fontSize: 12, color: '#ef4444' }}
                                                  onClick={() => updateBookingStatus(booking, 'cancelled')}
                                                >
                                                  Cancelar
                                                </button>
                                              ) : (
                                                <button
                                                  className="btn btn-secondary"
                                                  style={{ height: 28, padding: '0 10px', fontSize: 12, color: '#10b981' }}
                                                  onClick={() => updateBookingStatus(booking, 'confirmed')}
                                                >
                                                  Reconfirmar
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

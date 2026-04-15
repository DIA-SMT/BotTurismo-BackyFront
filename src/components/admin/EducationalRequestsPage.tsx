'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  formatDateToDisplay,
  getCircuitLabel,
  getInstitutionTypeLabel,
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
} from '@/lib/educational-bus-requests'
import { CalendarDays, ChevronLeft, ChevronRight, Download, Eye, Filter, List, Mail, MessageCircle, RefreshCw, Search } from 'lucide-react'

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
  const todayKey = useMemo(() => getTodayDateStringInBuenosAires(), [])
  const todayParts = useMemo(() => parseBusinessDateParts(todayKey), [todayKey])
  const initialMonthKey = useMemo(() => {
    if (!todayParts) return buildMonthKey(new Date().getFullYear(), new Date().getMonth() + 1)
    return buildMonthKey(todayParts.year, todayParts.month)
  }, [todayParts])

  const [filters, setFilters] = useState<EducationalBusRequestFilters>({})
  const [requests, setRequests] = useState<EducationalBusRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [currentMonthKey, setCurrentMonthKey] = useState(initialMonthKey)
  const [selectedDate, setSelectedDate] = useState(todayKey)

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

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Solicitudes Educativas</h2>
          <p>Revisión y seguimiento de solicitudes para el bus turístico educativo.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchRequests} disabled={loading}>
          <RefreshCw size={14} style={loading ? { animation: 'spin 0.6s linear infinite' } : {}} />
          Actualizar
        </button>
      </div>

      <div className="page-body">
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
            ) : null}
          </div>

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
                          <div className="td-muted">{request.student_count} alumnos · {getCircuitLabel(request.circuit)}</div>
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

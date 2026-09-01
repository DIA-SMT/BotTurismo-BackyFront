'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Bike, Copy, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { formatDateTimeToDisplay } from '@/lib/educational-bus-requests'
import { bicitourSessionStatusLabels, type BicitourRoute, type BicitourSessionStatus } from '@/lib/bicitour'

interface RouteRow extends BicitourRoute {
  stopCount: number
  sessionCount: number
  liveSessionCount: number
}

interface SessionRow {
  id: number
  code: string
  status: BicitourSessionStatus
  mode: string
  created_at: string
  routeTitle: string
  participantCount: number
  averageScore: number
  answers: number
  correctAnswers: number
}

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
}

const modeLabels: Record<string, string> = {
  individual: 'Individual',
  teams: 'Por equipos',
  mixed: 'Mixta',
}

export default function BicitourAdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'routes' | 'sessions'>('routes')
  const [routes, setRoutes] = useState<RouteRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [routesResponse, sessionsResponse] = await Promise.all([
        fetch('/api/admin/bicitour/routes', { cache: 'no-store' }),
        fetch('/api/admin/bicitour/sessions', { cache: 'no-store' }),
      ])
      const routesPayload = await routesResponse.json()
      const sessionsPayload = await sessionsResponse.json()
      if (routesResponse.ok) setRoutes(routesPayload.data || [])
      if (sessionsResponse.ok) setSessions(sessionsPayload.data || [])
      if (!routesResponse.ok) setFeedback(routesPayload.error || 'No se pudieron cargar los recorridos (¿corriste la migración?).')
    } catch {
      setFeedback('No se pudieron cargar los datos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const createRoute = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/bicitour/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo crear.')
      router.push(`/admin/bicitour/${payload.data.id}`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el recorrido.')
    } finally {
      setBusy(false)
    }
  }

  const duplicateRoute = async (routeId: number) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/bicitour/routes/${routeId}/duplicate`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo duplicar.')
      setFeedback('Recorrido duplicado como borrador.')
      await fetchAll()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo duplicar.')
    } finally {
      setBusy(false)
    }
  }

  const deleteRoute = async (route: RouteRow) => {
    if (!window.confirm(`¿Eliminar "${route.title}"? Esta acción no se puede deshacer.`)) return
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/bicitour/routes/${route.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo eliminar.')
      await fetchAll()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar.')
    } finally {
      setBusy(false)
    }
  }

  const startSession = async (route: RouteRow) => {
    if (route.stopCount === 0) {
      setFeedback('El recorrido no tiene paradas. Editá el recorrido y cargalas primero.')
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/bicitour/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId: route.id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo crear la sesión.')
      router.push(`/admin/bicitour/sesion/${payload.data.id}`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la sesión.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="flex items-center gap-2" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bike size={22} /> Bicitour en vivo
        </h1>
        <div className="flex items-center gap-2">
          <button className={tab === 'routes' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setTab('routes')}>
            Recorridos
          </button>
          <button className={tab === 'sessions' ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setTab('sessions')}>
            Sesiones y estadísticas
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)' }}>
          {feedback}
        </div>
      ) : null}

      {tab === 'routes' ? (
        <>
          <div className="table-container" style={{ padding: 14 }}>
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <input
                className="input"
                style={{ flex: '1 1 260px' }}
                placeholder="Título del nuevo recorrido (ej: Bicitour Casco Histórico)"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                maxLength={120}
              />
              <button className="btn btn-primary" onClick={createRoute} disabled={busy || newTitle.trim().length < 3}>
                <Plus size={14} /> Crear recorrido
              </button>
            </div>
          </div>

          <div className="table-container">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Recorrido</th>
                    <th>Estado</th>
                    <th>Modalidad</th>
                    <th>Paradas</th>
                    <th>Sesiones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="loading-state" style={{ padding: 14 }}>
                          <div className="spinner" /> Cargando…
                        </div>
                      </td>
                    </tr>
                  ) : routes.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <p className="td-muted" style={{ padding: 14 }}>
                          No hay recorridos todavía. Creá el primero arriba.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    routes.map((route) => (
                      <tr key={route.id}>
                        <td>
                          <div className="td-text-primary">{route.title}</div>
                          {route.description ? <div className="td-muted">{route.description.slice(0, 80)}</div> : null}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background:
                                route.status === 'published'
                                  ? 'rgba(16,185,129,0.15)'
                                  : route.status === 'archived'
                                    ? 'rgba(148,163,184,0.2)'
                                    : 'rgba(245,158,11,0.15)',
                              color: route.status === 'published' ? '#10b981' : route.status === 'archived' ? '#64748b' : '#b45309',
                            }}
                          >
                            {statusLabels[route.status]}
                          </span>
                        </td>
                        <td>{modeLabels[route.mode]}</td>
                        <td>{route.stopCount}</td>
                        <td>
                          {route.sessionCount}
                          {route.liveSessionCount > 0 ? (
                            <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', marginLeft: 6 }}>
                              {route.liveSessionCount} en vivo
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => startSession(route)} disabled={busy}>
                              <Play size={13} /> Iniciar sesión
                            </button>
                            <Link className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }} href={`/admin/bicitour/${route.id}`}>
                              <Pencil size={13} /> Editar
                            </Link>
                            <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => duplicateRoute(route.id)} disabled={busy}>
                              <Copy size={13} /> Duplicar
                            </button>
                            {route.sessionCount === 0 ? (
                              <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13, color: '#ef4444' }} onClick={() => deleteRoute(route)} disabled={busy}>
                                <Trash2 size={13} />
                              </button>
                            ) : null}
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
      ) : (
        <div className="table-container">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Código</th>
                  <th>Recorrido</th>
                  <th>Estado</th>
                  <th>Participantes</th>
                  <th>Respuestas (correctas)</th>
                  <th>Puntaje promedio</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <p className="td-muted" style={{ padding: 14 }}>
                        Todavía no hay sesiones registradas.
                      </p>
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id}>
                      <td>{formatDateTimeToDisplay(session.created_at)}</td>
                      <td style={{ fontWeight: 700, letterSpacing: 1 }}>{session.code}</td>
                      <td>{session.routeTitle}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: session.status === 'finished' ? 'rgba(148,163,184,0.2)' : 'rgba(16,185,129,0.15)',
                            color: session.status === 'finished' ? '#64748b' : '#10b981',
                          }}
                        >
                          {bicitourSessionStatusLabels[session.status]}
                        </span>
                      </td>
                      <td>{session.participantCount}</td>
                      <td>
                        {session.answers} ({session.correctAnswers})
                      </td>
                      <td>{session.averageScore}</td>
                      <td>
                        <Link className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13, display: 'inline-flex', alignItems: 'center' }} href={`/admin/bicitour/sesion/${session.id}`}>
                          Abrir panel
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

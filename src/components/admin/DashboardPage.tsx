'use client'

import { useEffect, useState, useCallback } from 'react'
import { INTENT_LABELS } from '@/lib/supabase'
import type { KpiIntent, KpiOrigen, KpiActividad, KpiFranja, KpiInternacional } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { MessageSquare, Users, Globe, TrendingUp, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#ef4444', '#84cc16']

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e2035', border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12
    }}>
      <p style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#f1f5f9', fontWeight: 600 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [intents, setIntents] = useState<KpiIntent[]>([])
  const [origens, setOrigens] = useState<KpiOrigen[]>([])
  const [actividad, setActividad] = useState<KpiActividad[]>([])
  const [franjas, setFranjas] = useState<KpiFranja[]>([])
  const [internacionales, setInter] = useState<KpiInternacional[]>([])
  const [totalInteracciones, setTotal] = useState(0)
  const [totalTuristas, setTotalT] = useState(0)
  const [pctInternacional, setPct] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/dashboard', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudieron obtener las estadísticas.')
      const payload = result.data
      setIntents(payload.intents || [])
      setOrigens(payload.origins || [])
      setActividad(payload.activity || [])
      setFranjas(payload.timeSlots || [])
      setInter(payload.international || [])
      setTotal(payload.totalInteractions || 0)
      setTotalT(payload.totalTourists || 0)
      setPct(payload.internationalPct || 0)
      setLastUpdated(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Enrich intent data with labels
  const intentChartData = intents.map(i => ({
    ...i,
    label: INTENT_LABELS[i.intent]?.label || i.intent,
    emoji: INTENT_LABELS[i.intent]?.emoji || '💬',
    fill: INTENT_LABELS[i.intent]?.color || '#6366f1',
  }))

  const actividadChartData = actividad.slice(-30).map(a => ({
    ...a,
    dia: format(parseISO(a.dia), 'd MMM', { locale: es }),
  }))

  const franjaChartData = franjas.map(f => ({
    ...f,
    hora: `${String(f.hora).padStart(2, '0')}:00`,
  }))

  if (loading && intents.length === 0) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        Cargando estadísticas...
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>📊 Resumen General</h2>
          <p>Estadísticas en tiempo real del Bot Turístico SMT</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-muted">
              Actualizado: {format(lastUpdated, 'HH:mm:ss')}
            </span>
          )}
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 0.6s linear infinite' } : {}} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="stats-grid">
          <div className="stat-card" style={{ '--card-color': '#6366f1', '--card-color-bg': 'rgba(99,102,241,0.15)' } as any}>
            <div className="card-icon">💬</div>
            <div className="card-value">{totalInteracciones.toLocaleString('es-AR')}</div>
            <div className="card-label">Total Interacciones</div>
            <div className="card-sub">desde el inicio</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#10b981', '--card-color-bg': 'rgba(16,185,129,0.15)' } as any}>
            <div className="card-icon">👥</div>
            <div className="card-value">{totalTuristas.toLocaleString('es-AR')}</div>
            <div className="card-label">Turistas Únicos</div>
            <div className="card-sub">por número de WhatsApp</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#06b6d4', '--card-color-bg': 'rgba(6,182,212,0.15)' } as any}>
            <div className="card-icon">🌐</div>
            <div className="card-value">{pctInternacional}%</div>
            <div className="card-label">Turistas Internacionales</div>
            <div className="card-sub">consultaron en inglés</div>
          </div>
          <div className="stat-card" style={{ '--card-color': '#f59e0b', '--card-color-bg': 'rgba(245,158,11,0.15)' } as any}>
            <div className="card-icon">📈</div>
            <div className="card-value">{actividad.length > 0 ? actividad[actividad.length - 1]?.total_consultas ?? 0 : 0}</div>
            <div className="card-label">Consultas Hoy</div>
            <div className="card-sub">
              {actividad.length > 0 ? `${actividad[actividad.length - 1]?.turistas_unicos ?? 0} turistas únicos` : 'sin datos'}
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="charts-grid charts-grid-activity">
          {/* Actividad diaria */}
          <div className="chart-card">
            <h3><TrendingUp size={15} /> Actividad Diaria (últimos 30 días)</h3>
            {actividadChartData.length === 0 ? (
              <div className="empty-state"><div className="icon">📉</div><p>Sin datos aún</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={actividadChartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                  <XAxis dataKey="dia" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total_consultas" name="Consultas" stroke="#6366f1" strokeWidth={2} fill="url(#colorTotal)" />
                  <Area type="monotone" dataKey="turistas_unicos" name="Turistas únicos" stroke="#10b981" strokeWidth={2} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Origen geográfico */}
          <div className="chart-card">
            <h3>📍 Origen de Turistas (30 días)</h3>
            {origens.length === 0 ? (
              <div className="empty-state"><div className="icon">🗺️</div><p>Sin datos aún</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={origens} dataKey="total" nameKey="origen" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {origens.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(v) => <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="charts-grid">
          {/* Intents */}
          <div className="chart-card">
            <h3><MessageSquare size={15} /> Consultas por Tipo</h3>
            {intentChartData.length === 0 ? (
              <div className="empty-state"><div className="icon">💬</div><p>Sin datos aún</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={intentChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Total" radius={[0, 6, 6, 0]}>
                    {intentChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Franja horaria */}
          <div className="chart-card">
            <h3>🕐 Franja Horaria de Mayor Actividad</h3>
            {franjaChartData.length === 0 ? (
              <div className="empty-state"><div className="icon">🕐</div><p>Sin datos aún</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={franjaChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
                  <XAxis dataKey="hora" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Consultas" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Internacionales table */}
        {internacionales.length > 0 && (
          <div className="table-container">
            <div className="table-toolbar">
              <h3><Globe size={15} style={{ marginRight: 6 }} />Evolución Mensual</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Total</th>
                  <th>🇦🇷 Hispanoparlantes</th>
                  <th>🌐 Internacionales</th>
                  <th>% Intl.</th>
                </tr>
              </thead>
              <tbody>
                {internacionales.map((row, i) => (
                  <tr key={i}>
                    <td className="td-text-primary">{format(parseISO(row.mes), 'MMMM yyyy', { locale: es })}</td>
                    <td>{row.total}</td>
                    <td>{row.hispanoparlantes}</td>
                    <td style={{ color: 'var(--info)' }}>{row.internacionales}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)' }}>
                        {row.total > 0 ? Math.round((row.internacionales / row.total) * 100) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

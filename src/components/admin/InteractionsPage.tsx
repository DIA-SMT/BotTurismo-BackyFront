'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { INTENT_LABELS } from '@/lib/supabase'
import type { TouristInteraction } from '@/lib/supabase'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const PAGE_SIZE = 50

const INTENTS = Object.keys(INTENT_LABELS)
const IDIOMAS = [
    { value: '', label: 'Todos los idiomas' },
    { value: 'es', label: '🇦🇷 Español' },
    { value: 'en', label: '🌐 Inglés' },
]

function IntentBadge({ intent }: { intent: string | null }) {
    if (!intent) return <span className="text-muted">—</span>
    const info = INTENT_LABELS[intent]
    if (!info) return <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{intent}</span>
    return (
        <span className="badge" style={{ background: `${info.color}22`, color: info.color }}>
            {info.emoji} {info.label}
        </span>
    )
}

function LangBadge({ lang }: { lang: string | null }) {
    if (lang === 'en') return <span className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>🌐 EN</span>
    if (lang === 'es') return <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>🇦🇷 ES</span>
    return <span className="text-muted">—</span>
}

export default function InteractionsPage() {
    const [rows, setRows] = useState<TouristInteraction[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [intentFilter, setIntent] = useState('')
    const [langFilter, setLang] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [expandedRow, setExpanded] = useState<number | null>(null)
    // refreshKey: incrementing this forces a refetch even if other deps haven't changed
    const [refreshKey, setRefreshKey] = useState(0)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(page),
                intent: intentFilter,
                language: langFilter,
                dateFrom,
                dateTo,
                search,
            })
            const response = await fetch(`/api/admin/interactions?${params.toString()}`, { cache: 'no-store' })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'No se pudieron obtener las interacciones.')
            setRows(result.data || [])
            setTotal(result.total || 0)
        } catch (e) {
            console.error('Error fetching interactions:', e)
        } finally {
            setLoading(false)
        }
    }, [page, intentFilter, langFilter, dateFrom, dateTo, search, refreshKey])

    useEffect(() => { fetchData() }, [fetchData])

    const totalPages = Math.ceil(total / PAGE_SIZE)

    const hasFilters = !!(intentFilter || langFilter || dateFrom || dateTo || search)

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>💬 Interacciones del Bot</h2>
                    <p>{total.toLocaleString('es-AR')} interacciones registradas</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={() => setRefreshKey(k => k + 1)}
                    disabled={loading}
                >
                    <RefreshCw size={14} style={loading ? { animation: 'spin 0.6s linear infinite' } : {}} />
                    Actualizar
                </button>
            </div>

            <div className="page-body">
                <div className="table-container">
                    {/* Toolbar / Filters */}
                    <div className="table-toolbar">
                        {/* Row 1: search + refresh icon */}
                        <div className="flex items-center gap-2" style={{
                            background: 'var(--bg-2)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: '0 12px',
                            height: 36, flex: 1, minWidth: 140
                        }}>
                            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <input
                                className="input"
                                style={{ border: 'none', background: 'transparent', padding: 0, height: 'auto', flex: 1 }}
                                placeholder="Buscar en consultas..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(0) }}
                            />
                        </div>

                        <SlidersHorizontal size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

                        <select
                            className="select"
                            style={{ minWidth: 100, flex: '0 1 auto' }}
                            value={intentFilter}
                            onChange={e => { setIntent(e.target.value); setPage(0) }}
                        >
                            <option value="">Todos los intents</option>
                            {INTENTS.map(k => (
                                <option key={k} value={k}>{INTENT_LABELS[k].emoji} {INTENT_LABELS[k].label}</option>
                            ))}
                        </select>

                        <select
                            className="select"
                            style={{ minWidth: 90, flex: '0 1 auto' }}
                            value={langFilter}
                            onChange={e => { setLang(e.target.value); setPage(0) }}
                        >
                            {IDIOMAS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                        </select>

                        <input
                            type="date"
                            className="input"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(0) }}
                            title="Desde"
                            style={{ width: 130, flexShrink: 0 }}
                        />
                        <input
                            type="date"
                            className="input"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(0) }}
                            title="Hasta"
                            style={{ width: 130, flexShrink: 0 }}
                        />

                        {hasFilters && (
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setIntent(''); setLang(''); setDateFrom(''); setDateTo(''); setSearch(''); setPage(0) }}
                            >
                                ✕ Limpiar
                            </button>
                        )}
                    </div>

                    {/* Scrollable table wrapper */}
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha / Hora</th>
                                    <th>Turista</th>
                                    <th>Intent</th>
                                    <th className="interactions-col-lang">Idioma</th>
                                    <th className="interactions-col-origen">Origen</th>
                                    <th className="interactions-col-transport">Transporte</th>
                                    <th className="interactions-col-query">Consulta</th>
                                    <th className="interactions-col-chat">Live Chat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && rows.length === 0 ? (
                                    <tr><td colSpan={8}><div className="loading-state"><div className="spinner" />Cargando...</div></td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={8}><div className="empty-state"><div className="icon">🔍</div><p>No se encontraron interacciones</p></div></td></tr>
                                ) : rows.map(row => (
                                    <Fragment key={row.id}>
                                        <tr
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setExpanded(expandedRow === row.id ? null : row.id)}
                                        >
                                            <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>
                                                {format(parseISO(row.created_at), 'dd/MM HH:mm', { locale: es })}
                                            </td>
                                            <td>
                                                <div className="td-text-primary">{row.user_name || '—'}</div>
                                                <div className="td-muted">{row.chat_id ? `${row.chat_id}` : '—'}</div>
                                            </td>
                                            <td><IntentBadge intent={row.intent} /></td>
                                            <td className="interactions-col-lang"><LangBadge lang={row.language} /></td>
                                            <td className="interactions-col-origen td-muted">{row.origen_provincia || '—'}</td>
                                            <td className="interactions-col-transport td-muted">{row.medio_transporte || '—'}</td>
                                            <td className="interactions-col-query" style={{ maxWidth: 300 }}>
                                                <span style={{
                                                    display: 'block',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: 280,
                                                    fontSize: 12,
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    {row.query_text || '—'}
                                                </span>
                                            </td>
                                            <td className="interactions-col-chat">
                                                {row.live_chat_url ? (
                                                    <a
                                                        href={row.live_chat_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="live-chat-btn"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        Chat en Vivo
                                                    </a>
                                                ) : (
                                                    <span className="text-muted" style={{ fontSize: 12 }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedRow === row.id && (
                                            <tr key={`${row.id}-expanded`}>
                                                <td colSpan={8} style={{ padding: '0 16px 16px', background: 'var(--bg-2)' }}>
                                                    <div className="interactions-expanded-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 12 }}>
                                                        <div>
                                                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Consulta del turista</p>
                                                            <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{row.query_text || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Respuesta del bot</p>
                                                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{row.bot_response || '—'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button className="btn btn-secondary btn-icon" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                                <ChevronLeft size={16} />
                            </button>
                            <span>Página {page + 1} de {totalPages}</span>
                            <button className="btn btn-secondary btn-icon" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

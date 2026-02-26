'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { supabase, INTENT_LABELS } from '@/lib/supabase'
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

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('tourist_interactions')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

            if (intentFilter) query = query.eq('intent', intentFilter)
            if (langFilter) query = query.eq('language', langFilter)
            if (dateFrom) query = query.gte('created_at', dateFrom)
            if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')
            if (search) query = query.ilike('query_text', `%${search}%`)

            const { data, count } = await query
            if (data) setRows(data)
            if (count !== null) setTotal(count)
        } finally {
            setLoading(false)
        }
    }, [page, intentFilter, langFilter, dateFrom, dateTo, search])

    useEffect(() => { fetchData() }, [fetchData])

    const totalPages = Math.ceil(total / PAGE_SIZE)

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>💬 Interacciones del Bot</h2>
                    <p>{total.toLocaleString('es-AR')} interacciones registradas</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
                    <RefreshCw size={14} />
                    Actualizar
                </button>
            </div>

            <div className="page-body">
                <div className="table-container">
                    {/* Toolbar / Filters */}
                    <div className="table-toolbar">
                        <div className="flex items-center gap-2" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', height: 36, flex: 1, maxWidth: 320 }}>
                            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <input
                                className="input"
                                style={{ border: 'none', background: 'transparent', padding: 0, height: 'auto', flex: 1 }}
                                placeholder="Buscar en consultas..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(0) }}
                            />
                        </div>

                        <SlidersHorizontal size={16} style={{ color: 'var(--text-muted)' }} />

                        <select className="select" value={intentFilter} onChange={e => { setIntent(e.target.value); setPage(0) }}>
                            <option value="">Todos los intents</option>
                            {INTENTS.map(k => (
                                <option key={k} value={k}>{INTENT_LABELS[k].emoji} {INTENT_LABELS[k].label}</option>
                            ))}
                        </select>

                        <select className="select" value={langFilter} onChange={e => { setLang(e.target.value); setPage(0) }}>
                            {IDIOMAS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                        </select>

                        <input
                            type="date"
                            className="input"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(0) }}
                            title="Desde"
                            style={{ width: 140 }}
                        />
                        <input
                            type="date"
                            className="input"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(0) }}
                            title="Hasta"
                            style={{ width: 140 }}
                        />

                        {(intentFilter || langFilter || dateFrom || dateTo || search) && (
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setIntent(''); setLang(''); setDateFrom(''); setDateTo(''); setSearch(''); setPage(0) }}
                            >
                                ✕ Limpiar
                            </button>
                        )}
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha / Hora</th>
                                    <th>Turista</th>
                                    <th>Intent</th>
                                    <th>Idioma</th>
                                    <th>Origen</th>
                                    <th>Transporte</th>
                                    <th>Consulta</th>
                                    <th>Live Chat</th>
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
                                                <div className="td-muted">{row.chat_id ? `+${row.chat_id}` : '—'}</div>
                                            </td>
                                            <td><IntentBadge intent={row.intent} /></td>
                                            <td><LangBadge lang={row.language} /></td>
                                            <td className="td-muted">{row.origen_provincia || '—'}</td>
                                            <td className="td-muted">{row.medio_transporte || '—'}</td>
                                            <td style={{ maxWidth: 300 }}>
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
                                            <td>
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
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 12 }}>
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
                    <div className="pagination">
                        <span>
                            {total > 0
                                ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total.toLocaleString('es-AR')}`
                                : '0 resultados'}
                        </span>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setPage(p => p - 1)}
                            disabled={page === 0}
                            style={{ padding: '0 8px' }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            {page + 1} / {totalPages || 1}
                        </span>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setPage(p => p + 1)}
                            disabled={page + 1 >= totalPages}
                            style={{ padding: '0 8px' }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

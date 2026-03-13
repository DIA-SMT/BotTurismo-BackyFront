'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, CATEGORIAS } from '@/lib/supabase'
import type { FAQ } from '@/lib/supabase'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, X } from 'lucide-react'

// ── Toast ──────────────────────────────────────────────────────────────
type ToastType = { id: number; msg: string; type: 'success' | 'error' }
let toastId = 0

function ToastContainer({ toasts }: { toasts: ToastType[] }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast ${t.type}`}>
                    {t.type === 'success' ? '✅' : '❌'} {t.msg}
                </div>
            ))}
        </div>
    )
}

// ── Modal ──────────────────────────────────────────────────────────────
interface ModalProps {
    faq: Partial<FAQ> | null
    onClose: () => void
    onSave: (data: Partial<FAQ>) => void
    saving: boolean
}

const DEFAULT_FAQ: Partial<FAQ> = {
    pregunta: '', respuesta: '', categoria: 'general', activo: true, orden: 0
}

function FaqModal({ faq, onClose, onSave, saving }: ModalProps) {
    const [form, setForm] = useState<Partial<FAQ>>(faq || DEFAULT_FAQ)

    useEffect(() => { setForm(faq || DEFAULT_FAQ) }, [faq])

    const set = (field: keyof FAQ, value: any) => setForm(f => ({ ...f, [field]: value }))

    const isValid = Boolean(form.pregunta?.trim() && form.respuesta?.trim() && form.categoria)

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-header">
                    <h3>{faq?.id ? '✏️ Editar Pregunta' : '➕ Nueva Pregunta'}</h3>
                    <button className="btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label>Categoría</label>
                        <select className="select" style={{ width: '100%' }} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                            {Object.entries(CATEGORIAS).map(([k, v]) => (
                                <option key={k} value={k}>{v.emoji} {v.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Pregunta *</label>
                        <input
                            className="input"
                            style={{ width: '100%' }}
                            placeholder="¿Cuál es la pregunta del turista?"
                            value={form.pregunta || ''}
                            onChange={e => set('pregunta', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Respuesta *</label>
                        <textarea
                            className="input"
                            style={{ width: '100%', minHeight: 120 }}
                            placeholder="Respuesta completa que usará el bot..."
                            value={form.respuesta || ''}
                            onChange={e => set('respuesta', e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Orden (dentro de categoría)</label>
                            <input
                                className="input"
                                style={{ width: '100%' }}
                                type="number"
                                min={0}
                                value={form.orden ?? 0}
                                onChange={e => set('orden', parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Estado</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
                                <button
                                    type="button"
                                    className={`btn ${form.activo ? 'btn-success' : 'btn-secondary'}`}
                                    onClick={() => set('activo', !form.activo)}
                                >
                                    {form.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                    {form.activo ? 'Activo' : 'Inactivo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button
                        className="btn btn-primary"
                        onClick={() => isValid && onSave(form)}
                        disabled={!isValid || saving}
                    >
                        {saving ? <><div className="spinner" style={{ width: 14, height: 14 }} />Guardando...</> : '💾 Guardar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function FaqsPage() {
    const [faqs, setFaqs] = useState<FAQ[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [catFilter, setCatFilter] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [modalFaq, setModalFaq] = useState<Partial<FAQ> | null | false>(false) // false = closed
    const [toasts, setToasts] = useState<ToastType[]>([])

    const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
        const id = toastId++
        setToasts(t => [...t, { id, msg, type }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
    }

    const fetchFaqs = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('faqs')
            .select('*')
            .order('categoria', { ascending: true })
            .order('orden', { ascending: true })
            .order('id', { ascending: true })
        if (data) setFaqs(data)
        setLoading(false)
    }, [])

    useEffect(() => { fetchFaqs() }, [fetchFaqs])

    const handleSave = async (form: Partial<FAQ>) => {
        setSaving(true)
        try {
            if (form.id) {
                const { error } = await supabase
                    .from('faqs')
                    .update({ pregunta: form.pregunta, respuesta: form.respuesta, categoria: form.categoria, activo: form.activo, orden: form.orden })
                    .eq('id', form.id)
                if (error) throw error
                addToast('Pregunta actualizada correctamente')
            } else {
                const { error } = await supabase
                    .from('faqs')
                    .insert({ pregunta: form.pregunta, respuesta: form.respuesta, categoria: form.categoria, activo: form.activo ?? true, orden: form.orden ?? 0 })
                if (error) throw error
                addToast('Pregunta agregada correctamente')
            }
            setModalFaq(false)
            fetchFaqs()
        } catch (e: any) {
            addToast(e.message || 'Error al guardar', 'error')
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (faq: FAQ) => {
        const { error } = await supabase
            .from('faqs')
            .update({ activo: !faq.activo })
            .eq('id', faq.id)
        if (!error) {
            addToast(faq.activo ? 'Pregunta desactivada' : 'Pregunta activada')
            fetchFaqs()
        }
    }

    const deleteFaq = async (faq: FAQ) => {
        if (!confirm(`¿Eliminar la pregunta "${faq.pregunta.substring(0, 60)}..."?`)) return
        const { error } = await supabase.from('faqs').delete().eq('id', faq.id)
        if (!error) { addToast('Pregunta eliminada'); fetchFaqs() }
        else addToast('Error al eliminar', 'error')
    }

    // Filtered
    const filtered = faqs.filter(f => {
        if (!showInactive && !f.activo) return false
        if (catFilter && f.categoria !== catFilter) return false
        if (search) {
            const q = search.toLowerCase()
            return f.pregunta.toLowerCase().includes(q) || f.respuesta.toLowerCase().includes(q)
        }
        return true
    })

    // Group by category for display
    const byCat: Record<string, FAQ[]> = {}
    filtered.forEach(f => {
        if (!byCat[f.categoria]) byCat[f.categoria] = []
        byCat[f.categoria].push(f)
    })

    const activeCount = faqs.filter(f => f.activo).length
    const totalCount = faqs.length

    return (
        <>
            <div className="page-header">
                <div>
                    <h2>❓ Preguntas Frecuentes</h2>
                    <p>{activeCount} activas · {totalCount} totales · disponibles para el bot</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setModalFaq({ ...DEFAULT_FAQ })}
                >
                    <Plus size={15} /> Nueva Pregunta
                </button>
            </div>

            <div className="page-body">
                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="flex items-center gap-2"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', height: 36, flex: 1, maxWidth: 280 }}
                    >
                        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input
                            className="input"
                            style={{ border: 'none', background: 'transparent', padding: 0, height: 'auto', flex: 1 }}
                            placeholder="Buscar en FAQs..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={e => setShowInactive(e.target.checked)}
                            style={{ accentColor: 'var(--accent)' }}
                        />
                        Mostrar inactivas
                    </label>

                    <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
                        {filtered.length} / {totalCount} FAQs
                    </div>
                </div>

                {/* Category filters */}
                <div className="category-filters">
                    <button
                        className={`cat-filter ${catFilter === '' ? 'active' : ''}`}
                        onClick={() => setCatFilter('')}
                    >
                        ✨ Todas
                    </button>
                    {Object.entries(CATEGORIAS).map(([k, v]) => {
                        const count = faqs.filter(f => f.categoria === k && (showInactive || f.activo)).length
                        if (count === 0) return null
                        return (
                            <button
                                key={k}
                                className={`cat-filter ${catFilter === k ? 'active' : ''}`}
                                onClick={() => setCatFilter(catFilter === k ? '' : k)}
                            >
                                {v.emoji} {v.label}
                                <span style={{
                                    background: catFilter === k ? 'var(--accent)' : 'var(--bg-0)',
                                    color: catFilter === k ? 'white' : 'var(--text-muted)',
                                    borderRadius: 20, padding: '0 6px', fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: 'center'
                                }}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Loading */}
                {loading && (
                    <div className="loading-state"><div className="spinner" />Cargando preguntas...</div>
                )}

                {/* Empty */}
                {!loading && filtered.length === 0 && (
                    <div className="empty-state">
                        <div className="icon">🔍</div>
                        <p>No se encontraron preguntas frecuentes</p>
                    </div>
                )}

                {/* Groups */}
                {!loading && Object.entries(byCat).map(([cat, items]) => {
                    const catInfo = CATEGORIAS[cat] || { label: cat, emoji: '📌', color: '#6366f1' }
                    return (
                        <div key={cat} style={{ marginBottom: 28 }}>
                            <h3 style={{
                                fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8
                            }}>
                                <span style={{
                                    background: `${catInfo.color}22`,
                                    color: catInfo.color, padding: '4px 12px', borderRadius: 20,
                                    fontSize: 12
                                }}>
                                    {catInfo.emoji} {catInfo.label}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12, textTransform: 'none', letterSpacing: 0 }}>
                                    ({items.length} {items.length === 1 ? 'pregunta' : 'preguntas'})
                                </span>
                            </h3>

                            <div className="faq-grid">
                                {items.map(faq => (
                                    <div key={faq.id} className={`faq-card ${!faq.activo ? 'inactive' : ''}`}>
                                        <div className="faq-card-header">
                                            <span
                                                className="cat-badge"
                                                style={{ background: `${catInfo.color}22`, color: catInfo.color }}
                                            >
                                                {faq.activo ? '✅' : '⛔'} {faq.activo ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                        <h4 style={{ marginBottom: 8 }}>{faq.pregunta}</h4>
                                        <p>{faq.respuesta}</p>
                                        <div className="faq-card-actions">
                                            <button
                                                className={`btn ${faq.activo ? 'btn-danger' : 'btn-success'}`}
                                                onClick={() => toggleActive(faq)}
                                                title={faq.activo ? 'Desactivar' : 'Activar'}
                                                style={{ padding: '0 10px', height: 30, fontSize: 12 }}
                                            >
                                                {faq.activo ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                                                {faq.activo ? 'Desactivar' : 'Activar'}
                                            </button>
                                            <button
                                                className="btn-icon"
                                                style={{ height: 30 }}
                                                title="Editar"
                                                onClick={() => setModalFaq(faq)}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                className="btn-icon"
                                                style={{ height: 30, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
                                                title="Eliminar"
                                                onClick={() => deleteFaq(faq)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Modal */}
            {modalFaq !== false && (
                <FaqModal
                    faq={modalFaq}
                    onClose={() => setModalFaq(false)}
                    onSave={handleSave}
                    saving={saving}
                />
            )}

            <ToastContainer toasts={toasts} />
        </>
    )
}

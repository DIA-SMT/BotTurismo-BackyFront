'use client'

import { useCallback, useEffect, useState } from 'react'
import { CATEGORIAS } from '@/lib/supabase'
import type { FAQ } from '@/lib/supabase'
import { Pencil, Plus, Search, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'

type ToastType = { id: number; msg: string; type: 'success' | 'error' }
let toastId = 0

function ToastContainer({ toasts }: { toasts: ToastType[] }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.msg}
        </div>
      ))}
    </div>
  )
}

interface ModalProps {
  faq: Partial<FAQ> | null
  onClose: () => void
  onSave: (data: Partial<FAQ>) => void
  saving: boolean
}

const DEFAULT_FAQ: Partial<FAQ> = {
  pregunta: '',
  respuesta: '',
  categoria: 'general',
  activo: true,
  orden: 0,
}

function FaqModal({ faq, onClose, onSave, saving }: ModalProps) {
  const [form, setForm] = useState<Partial<FAQ>>(faq || DEFAULT_FAQ)

  useEffect(() => {
    setForm(faq || DEFAULT_FAQ)
  }, [faq])

  const setField = (field: keyof FAQ, value: any) => setForm((current) => ({ ...current, [field]: value }))
  const isValid = Boolean(form.pregunta?.trim() && form.respuesta?.trim() && form.categoria)

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{faq?.id ? 'Editar pregunta' : 'Nueva pregunta'}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Categoría</label>
            <select className="select" style={{ width: '100%' }} value={form.categoria} onChange={(event) => setField('categoria', event.target.value)}>
              {Object.entries(CATEGORIAS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Pregunta *</label>
            <input className="input" style={{ width: '100%' }} value={form.pregunta || ''} onChange={(event) => setField('pregunta', event.target.value)} />
          </div>
          <div className="form-group">
            <label>Respuesta *</label>
            <textarea className="input" style={{ width: '100%', minHeight: 120 }} value={form.respuesta || ''} onChange={(event) => setField('respuesta', event.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Orden</label>
              <input className="input" style={{ width: '100%' }} type="number" min={0} value={form.orden ?? 0} onChange={(event) => setField('orden', Number.parseInt(event.target.value, 10) || 0)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Estado</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
                <button type="button" className={`btn ${form.activo ? 'btn-success' : 'btn-secondary'}`} onClick={() => setField('activo', !form.activo)}>
                  {form.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {form.activo ? 'Activa' : 'Inactiva'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => isValid && onSave(form)} disabled={!isValid || saving}>
            {saving ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} />
                Guardando...
              </>
            ) : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modalFaq, setModalFaq] = useState<Partial<FAQ> | null | false>(false)
  const [toasts, setToasts] = useState<ToastType[]>([])

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = toastId++
    setToasts((current) => [...current, { id, msg, type }])
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3500)
  }

  const fetchFaqs = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/admin/faqs', { cache: 'no-store' })
    const result = await response.json()
    if (response.ok) setFaqs(result.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFaqs()
  }, [fetchFaqs])

  const handleSave = async (form: Partial<FAQ>) => {
    setSaving(true)
    try {
      if (form.id) {
        const response = await fetch(`/api/admin/faqs/${form.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pregunta: form.pregunta, respuesta: form.respuesta, categoria: form.categoria, activo: form.activo, orden: form.orden }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Error al guardar')
        addToast('Pregunta actualizada correctamente')
      } else {
        const response = await fetch('/api/admin/faqs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pregunta: form.pregunta, respuesta: form.respuesta, categoria: form.categoria, activo: form.activo ?? true, orden: form.orden ?? 0 }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Error al guardar')
        addToast('Pregunta agregada correctamente')
      }
      setModalFaq(false)
      fetchFaqs()
    } catch (error: any) {
      addToast(error.message || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (faq: FAQ) => {
    const response = await fetch(`/api/admin/faqs/${faq.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !faq.activo }),
    })
    if (response.ok) {
      addToast(faq.activo ? 'Pregunta desactivada' : 'Pregunta activada')
      fetchFaqs()
    }
  }

  const deleteFaq = async (faq: FAQ) => {
    if (!confirm(`¿Eliminar la pregunta "${faq.pregunta.substring(0, 60)}..."?`)) return
    const response = await fetch(`/api/admin/faqs/${faq.id}`, { method: 'DELETE' })
    if (response.ok) {
      addToast('Pregunta eliminada')
      fetchFaqs()
      return
    }
    addToast('Error al eliminar', 'error')
  }

  const filtered = faqs.filter((faq) => {
    if (!showInactive && !faq.activo) return false
    if (catFilter && faq.categoria !== catFilter) return false
    if (!search) return true
    const query = search.toLowerCase()
    return faq.pregunta.toLowerCase().includes(query) || faq.respuesta.toLowerCase().includes(query)
  })

  const byCat: Record<string, FAQ[]> = {}
  filtered.forEach((faq) => {
    if (!byCat[faq.categoria]) byCat[faq.categoria] = []
    byCat[faq.categoria].push(faq)
  })
  const categoryKeys = Array.from(new Set([...Object.keys(CATEGORIAS), ...faqs.map((faq) => faq.categoria)]))

  const activeCount = faqs.filter((faq) => faq.activo).length
  const totalCount = faqs.length

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Preguntas frecuentes</h2>
          <p>{activeCount} activas · {totalCount} totales · disponibles para el bot</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalFaq({ ...DEFAULT_FAQ })}>
          <Plus size={15} /> Nueva pregunta
        </button>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="flex items-center gap-2" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', height: 36, flex: 1, maxWidth: 280 }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input className="input" style={{ border: 'none', background: 'transparent', padding: 0, height: 'auto', flex: 1 }} placeholder="Buscar en FAQs..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} style={{ accentColor: 'var(--accent)' }} />
            Mostrar inactivas
          </label>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length} / {totalCount} FAQs
          </div>
        </div>

        <div className="category-filters">
          <button className={`cat-filter ${catFilter === '' ? 'active' : ''}`} onClick={() => setCatFilter('')}>Todas</button>
          {categoryKeys.map((key) => {
            const value = CATEGORIAS[key] || { label: key, emoji: '•', color: '#6366f1' }
            const count = faqs.filter((faq) => faq.categoria === key && (showInactive || faq.activo)).length
            if (count === 0) return null
            return (
              <button key={key} className={`cat-filter ${catFilter === key ? 'active' : ''}`} onClick={() => setCatFilter(catFilter === key ? '' : key)}>
                {value.label}
                <span style={{ background: catFilter === key ? 'var(--accent)' : 'var(--bg-0)', color: catFilter === key ? 'white' : 'var(--text-muted)', borderRadius: 20, padding: '0 6px', fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: 'center' }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" />Cargando preguntas...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="icon">?</div><p>No se encontraron preguntas frecuentes</p></div>
        ) : Object.entries(byCat).map(([cat, items]) => {
          const catInfo = CATEGORIAS[cat] || { label: cat, emoji: '•', color: '#6366f1' }
          return (
            <div key={cat} style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: `${catInfo.color}22`, color: catInfo.color, padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>
                  {catInfo.label}
                </span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12, textTransform: 'none', letterSpacing: 0 }}>
                  ({items.length} {items.length === 1 ? 'pregunta' : 'preguntas'})
                </span>
              </h3>

              <div className="faq-grid">
                {items.map((faq) => (
                  <div key={faq.id} className={`faq-card ${!faq.activo ? 'inactive' : ''}`}>
                    <div className="faq-card-header">
                      <span className="cat-badge" style={{ background: `${catInfo.color}22`, color: catInfo.color }}>
                        {faq.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <h4 style={{ marginBottom: 8 }}>{faq.pregunta}</h4>
                    <p>{faq.respuesta}</p>
                    <div className="faq-card-actions">
                      <button className={`btn ${faq.activo ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(faq)} style={{ padding: '0 10px', height: 30, fontSize: 12 }}>
                        {faq.activo ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {faq.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button className="btn-icon" style={{ height: 30 }} onClick={() => setModalFaq(faq)}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn-icon" style={{ height: 30, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => deleteFaq(faq)}>
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

      {modalFaq !== false ? <FaqModal faq={modalFaq} onClose={() => setModalFaq(false)} onSave={handleSave} saving={saving} /> : null}
      <ToastContainer toasts={toasts} />
    </>
  )
}

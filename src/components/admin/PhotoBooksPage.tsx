'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, ImagePlus, Plus, QrCode, Trash2, X } from 'lucide-react'
import QRCode from 'qrcode'
import type { PhotoBook } from '@/lib/photo-books'

interface Book extends Omit<PhotoBook, 'photo_book_photos'> {
  photo_book_photos: Array<{ id: string; storage_path: string; original_name: string; size_bytes: number }>
}

interface ShareModalData {
  title: string
  url: string
  qrDataUrl: string
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })

export default function PhotoBooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [shareModal, setShareModal] = useState<ShareModalData | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [title, setTitle] = useState('')
  const [tourDate, setTourDate] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/admin/photo-books', { cache: 'no-store' })
    const result = await response.json()
    if (response.ok) setBooks(result.data || [])
    else setMessage({ text: result.error || 'No se pudieron cargar los books.', type: 'error' })
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  const activeBooks = useMemo(
    () => books.filter((book) => new Date(book.expires_at).getTime() > Date.now()).length,
    [books],
  )

  const showShare = async (book: Pick<Book, 'title' | 'access_token'>) => {
    const url = `${window.location.origin}/fotos/${book.access_token}`
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 360,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    })
    setShareModal({ title: book.title, url, qrDataUrl })
  }

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setMessage({ text: 'Enlace copiado.', type: 'success' })
  }

  const resetForm = () => {
    setTitle('')
    setTourDate('')
    setDescription('')
    setPhotos([])
    setShowForm(false)
  }

  const createBook = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !tourDate || photos.length === 0) return

    setSaving(true)
    setMessage(null)
    const formData = new FormData()
    formData.set('title', title.trim())
    formData.set('tour_date', tourDate)
    formData.set('description', description.trim())
    photos.forEach((photo) => formData.append('photos', photo))

    try {
      const response = await fetch('/api/admin/photo-books', { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo crear el book.')

      const qrDataUrl = await QRCode.toDataURL(result.data.access_url, { width: 360, margin: 2 })
      setShareModal({ title: result.data.title, url: result.data.access_url, qrDataUrl })
      setMessage({ text: 'Book creado y fotos cargadas correctamente.', type: 'success' })
      resetForm()
      await fetchBooks()
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'No se pudo crear el book.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteBook = async (book: Book) => {
    if (!confirm(`¿Eliminar "${book.title}" y todas sus fotos?`)) return
    const response = await fetch(`/api/admin/photo-books/${book.id}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) {
      setMessage({ text: result.error || 'No se pudo eliminar el book.', type: 'error' })
      return
    }
    setMessage({ text: 'Book eliminado.', type: 'success' })
    fetchBooks()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Books de fotos</h2>
          <p>{activeBooks} activos · se eliminan automáticamente 7 días después de su creación</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Nuevo book
        </button>
      </div>

      <div className="page-body">
        {message ? (
          <div className={`photo-book-message ${message.type}`}>
            {message.text}
            <button onClick={() => setMessage(null)} aria-label="Cerrar"><X size={15} /></button>
          </div>
        ) : null}

        {showForm ? (
          <form className="photo-book-form" onSubmit={createBook}>
            <div className="photo-book-form-header">
              <div>
                <h3>Nuevo book privado</h3>
                <p>El enlace y el QR funcionarán hasta la fecha de vencimiento.</p>
              </div>
              <button type="button" className="btn-icon" onClick={resetForm}><X size={16} /></button>
            </div>
            <div className="photo-book-form-grid">
              <div className="form-group">
                <label>Nombre del recorrido *</label>
                <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Circuito histórico - turno mañana" required />
              </div>
              <div className="form-group">
                <label>Fecha del recorrido *</label>
                <input className="input" type="date" value={tourDate} onChange={(event) => setTourDate(event.target.value)} required />
              </div>
              <div className="form-group photo-book-description">
                <label>Descripción</label>
                <textarea className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mensaje opcional para los pasajeros" />
              </div>
              <div className="form-group photo-book-files">
                <label>Fotos * (máximo 60, hasta 15 MB cada una)</label>
                <label className="photo-dropzone">
                  <ImagePlus size={28} />
                  <span>{photos.length ? `${photos.length} fotos seleccionadas` : 'Elegir fotos del recorrido'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 60))}
                  />
                </label>
              </div>
            </div>
            <div className="photo-book-form-actions">
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving || !title.trim() || !tourDate || photos.length === 0}>
                {saving ? <><span className="spinner" /> Subiendo fotos...</> : 'Crear book y generar QR'}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <div className="loading-state"><span className="spinner" /> Cargando books...</div>
        ) : books.length === 0 ? (
          <div className="empty-state"><div className="icon">📷</div><p>Todavía no hay books de fotos.</p></div>
        ) : (
          <div className="photo-book-grid">
            {books.map((book) => {
              const expired = new Date(book.expires_at).getTime() <= Date.now()
              return (
                <article className={`photo-book-card ${expired ? 'expired' : ''}`} key={book.id}>
                  <div className="photo-book-card-top">
                    <span className={`photo-book-status ${expired ? 'expired' : ''}`}>{expired ? 'Vencido' : 'Activo'}</span>
                    <span>{book.photo_book_photos?.length || 0} fotos</span>
                  </div>
                  <h3>{book.title}</h3>
                  <p className="photo-book-date">Recorrido: {dateFormatter.format(new Date(`${book.tour_date}T12:00:00`))}</p>
                  {book.description ? <p className="photo-book-description-text">{book.description}</p> : null}
                  <p className="photo-book-expiry">Vence: {dateFormatter.format(new Date(book.expires_at))}</p>
                  <div className="photo-book-actions">
                    {!expired ? (
                      <>
                        <button className="btn btn-primary" onClick={() => showShare(book)}><QrCode size={15} /> QR y enlace</button>
                        <a className="btn btn-secondary" href={`/fotos/${book.access_token}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ver</a>
                      </>
                    ) : null}
                    <button className="btn btn-danger" onClick={() => deleteBook(book)}><Trash2 size={15} /> Eliminar</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {shareModal ? (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setShareModal(null)}>
          <div className="modal photo-share-modal">
            <div className="modal-header">
              <div><h3>Compartir book</h3><p>{shareModal.title}</p></div>
              <button className="btn-icon" onClick={() => setShareModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shareModal.qrDataUrl} alt={`QR para ${shareModal.title}`} className="photo-qr" />
              <div className="photo-share-link"><span>{shareModal.url}</span></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => copyLink(shareModal.url)}><Copy size={15} /> Copiar enlace</button>
              <a className="btn btn-primary" href={shareModal.qrDataUrl} download={`qr-${shareModal.title}.png`}><QrCode size={15} /> Descargar QR</a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

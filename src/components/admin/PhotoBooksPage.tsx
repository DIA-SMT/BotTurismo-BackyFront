'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Edit3, ExternalLink, ImagePlus, Plus, QrCode, Save, Trash2, Upload, X } from 'lucide-react'
import QRCode from 'qrcode'
import { MAX_PHOTOS_PER_BOOK } from '@/lib/photo-books'
import type { PhotoBook } from '@/lib/photo-books'

interface Book extends Omit<PhotoBook, 'photo_book_photos'> {
  photo_book_photos: Array<{
    id: string
    storage_path: string
    original_name: string
    mime_type?: string
    size_bytes: number
    sort_order?: number
  }>
}

interface ShareModalData {
  title: string
  url: string
  qrDataUrl: string
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })

interface CurrentPhotoPreview {
  id: string
  name: string
  preview_url: string
  sort_order: number
}

function SelectedPhotoPreviews({ files }: { files: File[] }) {
  const [previews, setPreviews] = useState<Array<{ name: string; url: string }>>([])

  useEffect(() => {
    const nextPreviews = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }))
    setPreviews(nextPreviews)
    return () => nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
  }, [files])

  if (previews.length === 0) return null

  return (
    <div className="photo-preview-grid" aria-label="Previsualización de fotos seleccionadas">
      {previews.map((preview, index) => (
        <figure className="photo-preview-item" key={`${preview.name}-${index}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.url} alt={`Previsualización ${index + 1}: ${preview.name}`} />
          <figcaption><span>{index + 1}</span>{preview.name}</figcaption>
        </figure>
      ))}
    </div>
  )
}

function sortPhotos(book: Book) {
  return [...(book.photo_book_photos || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export default function PhotoBooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [uploadingMore, setUploadingMore] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [shareModal, setShareModal] = useState<ShareModalData | null>(null)
  const [editBook, setEditBook] = useState<Book | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [title, setTitle] = useState('')
  const [tourDate, setTourDate] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [editTitle, setEditTitle] = useState('')
  const [editTourDate, setEditTourDate] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [morePhotos, setMorePhotos] = useState<File[]>([])
  const [currentPhotoPreviews, setCurrentPhotoPreviews] = useState<CurrentPhotoPreview[]>([])
  const [loadingPhotoPreviews, setLoadingPhotoPreviews] = useState(false)

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

  const updateBookInState = (updatedBook: Book) => {
    setBooks((current) => current.map((book) => (book.id === updatedBook.id ? updatedBook : book)))
    setEditBook(updatedBook)
  }

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

  const loadCurrentPhotoPreviews = async (bookId: string) => {
    setLoadingPhotoPreviews(true)
    try {
      const response = await fetch(`/api/admin/photo-books/${bookId}/photos`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las previsualizaciones.')
      setCurrentPhotoPreviews(result.data || [])
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'No se pudieron cargar las previsualizaciones.', type: 'error' })
      setCurrentPhotoPreviews([])
    } finally {
      setLoadingPhotoPreviews(false)
    }
  }

  const openEditModal = (book: Book) => {
    setEditBook(book)
    setEditTitle(book.title)
    setEditTourDate(book.tour_date)
    setEditDescription(book.description || '')
    setMorePhotos([])
    setCurrentPhotoPreviews([])
    loadCurrentPhotoPreviews(book.id)
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

  const saveBookDetails = async ({ showSuccessMessage = true } = {}) => {
    if (!editBook || !editTitle.trim() || !editTourDate) return false

    setEditing(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/photo-books/${editBook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          tour_date: editTourDate,
          description: editDescription.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el book.')

      updateBookInState(result.data)
      if (showSuccessMessage) setMessage({ text: 'Book actualizado.', type: 'success' })
      return true
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'No se pudo actualizar el book.', type: 'error' })
      return false
    } finally {
      setEditing(false)
    }
  }

  const addPhotosToBook = async ({ showSuccessMessage = true } = {}) => {
    if (!editBook || morePhotos.length === 0) return true

    setUploadingMore(true)
    setMessage(null)
    const formData = new FormData()
    morePhotos.forEach((photo) => formData.append('photos', photo))

    try {
      const response = await fetch(`/api/admin/photo-books/${editBook.id}/photos`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudieron agregar las fotos.')

      updateBookInState(result.data)
      setMorePhotos([])
      await loadCurrentPhotoPreviews(editBook.id)
      if (showSuccessMessage) setMessage({ text: `${result.added_count || morePhotos.length} fotos agregadas al book.`, type: 'success' })
      return true
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'No se pudieron agregar las fotos.', type: 'error' })
      return false
    } finally {
      setUploadingMore(false)
    }
  }

  const saveAndCloseEditModal = async () => {
    const detailsSaved = await saveBookDetails({ showSuccessMessage: false })
    if (!detailsSaved) return

    const photosSaved = await addPhotosToBook({ showSuccessMessage: false })
    if (!photosSaved) return

    setEditBook(null)
    setMessage({ text: 'Cambios guardados.', type: 'success' })
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

  const selectedBookPhotoCount = editBook?.photo_book_photos?.length || 0
  const remainingSlots = Math.max(0, MAX_PHOTOS_PER_BOOK - selectedBookPhotoCount)
  const selectedBookExpired = editBook ? new Date(editBook.expires_at).getTime() <= Date.now() : false

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Books de fotos</h2>
          <p>{activeBooks} activos · máximo {MAX_PHOTOS_PER_BOOK} fotos por book · se eliminan automáticamente 7 días después</p>
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
                <h3>Nuevo book</h3>
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
                <label>Fotos * (máximo {MAX_PHOTOS_PER_BOOK}, hasta 15 MB cada una)</label>
                <label className="photo-dropzone">
                  <ImagePlus size={28} />
                  <span>{photos.length ? `${photos.length} fotos seleccionadas` : 'Elegir fotos del recorrido'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, MAX_PHOTOS_PER_BOOK))}
                  />
                </label>
                <SelectedPhotoPreviews files={photos} />
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
              const photoCount = book.photo_book_photos?.length || 0
              return (
                <article className={`photo-book-card ${expired ? 'expired' : ''}`} key={book.id}>
                  <div className="photo-book-card-top">
                    <span className={`photo-book-status ${expired ? 'expired' : ''}`}>{expired ? 'Vencido' : 'Activo'}</span>
                    <span>{photoCount}/{MAX_PHOTOS_PER_BOOK} fotos</span>
                  </div>
                  <h3>{book.title}</h3>
                  <p className="photo-book-date">Recorrido: {dateFormatter.format(new Date(`${book.tour_date}T12:00:00`))}</p>
                  {book.description ? <p className="photo-book-description-text">{book.description}</p> : null}
                  <p className="photo-book-expiry">Vence: {dateFormatter.format(new Date(book.expires_at))}</p>
                  <div className="photo-book-actions">
                    <button className="btn btn-secondary" onClick={() => openEditModal(book)}><Edit3 size={15} /> Editar</button>
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

      {editBook ? (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setEditBook(null)}>
          <div className="modal photo-book-edit-modal">
            <div className="modal-header">
              <div>
                <h3>Editar book</h3>
                <p className="photo-book-modal-subtitle">{selectedBookPhotoCount}/{MAX_PHOTOS_PER_BOOK} fotos · quedan {remainingSlots} lugares</p>
              </div>
              <button className="btn btn-primary" onClick={saveAndCloseEditModal} disabled={editing || uploadingMore || !editTitle.trim() || !editTourDate}>
                {editing || uploadingMore ? <><span className="spinner" /> Guardando...</> : <><Save size={15} /> Guardar y salir</>}
              </button>
            </div>
            <div className="modal-body">
              <div className="photo-book-modal-section">
                <h4>Datos del recorrido</h4>
                <div className="photo-book-form-grid">
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input className="input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input className="input" type="date" value={editTourDate} onChange={(event) => setEditTourDate(event.target.value)} />
                  </div>
                  <div className="form-group photo-book-description">
                    <label>Descripción</label>
                    <textarea className="input" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                  </div>
                </div>
              </div>

              <div className="photo-book-modal-section">
                <h4>Agregar fotos al mismo book</h4>
                <p className="photo-book-helper">
                  El enlace y el QR no cambian. Las fotos nuevas aparecen en la galería pública del book.
                </p>
                <label className={`photo-dropzone ${remainingSlots === 0 || selectedBookExpired ? 'disabled' : ''}`}>
                  <ImagePlus size={28} />
                  <span>
                    {selectedBookExpired
                      ? 'El book está vencido'
                      : remainingSlots === 0
                        ? 'Este book ya alcanzó el máximo'
                        : morePhotos.length
                          ? `${morePhotos.length} fotos listas para agregar`
                          : `Elegir hasta ${remainingSlots} fotos más`}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    disabled={remainingSlots === 0 || selectedBookExpired}
                    onChange={(event) => setMorePhotos(Array.from(event.target.files || []).slice(0, remainingSlots))}
                  />
                </label>
                <SelectedPhotoPreviews files={morePhotos} />
                <button className="btn btn-primary mt-4" onClick={() => addPhotosToBook()} disabled={uploadingMore || morePhotos.length === 0 || selectedBookExpired}>
                  {uploadingMore ? <><span className="spinner" /> Agregando...</> : <><Upload size={15} /> Agregar fotos</>}
                </button>
              </div>

              <div className="photo-book-modal-section">
                <h4>Fotos actuales</h4>
                {loadingPhotoPreviews ? (
                  <div className="loading-state photo-preview-loading"><span className="spinner" /> Cargando fotos...</div>
                ) : currentPhotoPreviews.length ? (
                  <div className="photo-preview-grid current">
                    {currentPhotoPreviews.map((photo, index) => (
                      <figure className="photo-preview-item" key={photo.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.preview_url} alt={`Foto ${index + 1}: ${photo.name}`} loading="lazy" />
                        <figcaption><span>{index + 1}</span>{photo.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="photo-book-helper">No hay fotos disponibles para previsualizar.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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

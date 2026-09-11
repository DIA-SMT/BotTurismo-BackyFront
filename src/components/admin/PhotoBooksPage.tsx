'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Edit3, ExternalLink, ImagePlus, Plus, QrCode, Save, Trash2, Upload, X } from 'lucide-react'
import QRCode from 'qrcode'
import { MAX_PHOTOS_PER_BOOK } from '@/lib/photo-books'
import type { PhotoBook, TourGuideLogEntry } from '@/lib/photo-books'
import { DateInput } from '@/components/DateInput'

// Valor especial del selector de recorrido para escribir un nombre a mano
// (eventos fuera del catálogo de circuitos).
const customTitleChoice = '__custom__'

interface ApiResult {
  error?: string
  data?: unknown
  uploads?: Array<{ path: string; signedUrl: string; name: string }>
  added_count?: number
}

// Vercel responde con TEXTO plano (no JSON) en errores de infraestructura
// (ej. 413 "Request Entity Too Large"): parsear a mano para no mostrar
// "Unexpected token ..." al usuario.
async function safeJson(response: Response): Promise<ApiResult | null> {
  try {
    return (await response.json()) as ApiResult
  } catch {
    return null
  }
}

// Sube las fotos DIRECTO a Supabase Storage con las URLs firmadas que dio el
// server (los bodies por Vercel se cortan en ~4,5 MB, por eso no viajan por
// la API). Concurrencia 3, con progreso.
async function uploadFilesToSignedUrls(
  uploads: Array<{ path: string; signedUrl: string; name: string }>,
  files: File[],
  onProgress: (done: number) => void,
) {
  const registered: Array<{ path: string; name: string; type: string; size: number }> = []
  const failedNames: string[] = []
  let done = 0
  const queue = uploads.map((upload, index) => ({ upload, file: files[index] }))

  const workers = Array.from({ length: 3 }, async () => {
    for (;;) {
      const item = queue.shift()
      if (!item) break
      try {
        const response = await fetch(item.upload.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': item.file.type },
          body: item.file,
        })
        if (!response.ok) throw new Error(String(response.status))
        registered.push({ path: item.upload.path, name: item.file.name, type: item.file.type, size: item.file.size })
      } catch {
        failedNames.push(item.file.name)
      } finally {
        done += 1
        onProgress(done)
      }
    }
  })
  await Promise.all(workers)

  // El prefijo numerado del path restaura el orden original de las fotos.
  registered.sort((a, b) => a.path.localeCompare(b.path))
  return { registered, failedNames }
}

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
  const [titleChoice, setTitleChoice] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [titleDetail, setTitleDetail] = useState('')
  const [guideName, setGuideName] = useState('')
  const [peopleCount, setPeopleCount] = useState('')
  const [tourDate, setTourDate] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [circuitNames, setCircuitNames] = useState<string[]>([])
  const [guideLog, setGuideLog] = useState<TourGuideLogEntry[]>([])
  const [editTitle, setEditTitle] = useState('')
  const [editGuideName, setEditGuideName] = useState('')
  const [editPeopleCount, setEditPeopleCount] = useState('')
  const [editTourDate, setEditTourDate] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [morePhotos, setMorePhotos] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [currentPhotoPreviews, setCurrentPhotoPreviews] = useState<CurrentPhotoPreview[]>([])
  const [loadingPhotoPreviews, setLoadingPhotoPreviews] = useState(false)

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/admin/photo-books', { cache: 'no-store' })
    const result = await response.json()
    if (response.ok) {
      setBooks(result.data || [])
      setGuideLog(result.guideLog || [])
    } else setMessage({ text: result.error || 'No se pudieron cargar los books.', type: 'error' })
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  // Circuitos activos para el selector de recorrido (así los nombres quedan
  // uniformes; si falla, queda la opción "Otro recorrido…" con texto libre).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/admin/tourist-circuits', { cache: 'no-store' })
        const result = await response.json()
        if (!cancelled && response.ok) {
          const names = (result.data || [])
            .filter((circuit: { active?: boolean }) => circuit.active)
            .map((circuit: { name_es?: string }) => circuit.name_es)
            .filter(Boolean)
          setCircuitNames(names)
        }
      } catch {
        // sin catálogo: el selector ofrece solo "Otro recorrido…"
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Conteo histórico por guía (de tour_guide_log, que no se borra con los
  // books): recorridos hechos y personas guiadas — la estadística de turismo.
  const guideStats = useMemo(() => {
    const counts = new Map<string, { tours: number; people: number }>()
    for (const entry of guideLog) {
      const key = entry.guide_name.trim()
      if (!key) continue
      const current = counts.get(key) || { tours: 0, people: 0 }
      current.tours += 1
      current.people += entry.people_count || 0
      counts.set(key, current)
    }
    return [...counts.entries()].sort((a, b) => b[1].tours - a[1].tours)
  }, [guideLog])

  const baseTitle = titleChoice === customTitleChoice ? customTitle.trim() : titleChoice
  const composedTitle = `${baseTitle}${titleDetail.trim() ? ` - ${titleDetail.trim()}` : ''}`

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
    setTitleChoice('')
    setCustomTitle('')
    setTitleDetail('')
    setGuideName('')
    setPeopleCount('')
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
    setEditGuideName(book.guide_name || '')
    setEditPeopleCount(book.people_count ? String(book.people_count) : '')
    setEditTourDate(book.tour_date)
    setEditDescription(book.description || '')
    setMorePhotos([])
    setCurrentPhotoPreviews([])
    loadCurrentPhotoPreviews(book.id)
  }

  const createBook = async (event: React.FormEvent) => {
    event.preventDefault()
    const people = Number(peopleCount)
    if (!baseTitle || !guideName.trim() || !Number.isInteger(people) || people < 1 || !tourDate || photos.length === 0) return

    setSaving(true)
    setMessage(null)
    try {
      // 1. Crear el book y pedir las URLs firmadas (las fotos NO viajan acá).
      const response = await fetch('/api/admin/photo-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: composedTitle,
          guide_name: guideName.trim(),
          people_count: people,
          tour_date: tourDate,
          description: description.trim(),
          photos: photos.map((photo) => ({ name: photo.name, type: photo.type, size: photo.size })),
        }),
      })
      const result = await safeJson(response)
      if (!response.ok || !result) throw new Error(result?.error || 'No se pudo crear el book.')

      // 2. Subir las fotos directo a Storage.
      setUploadProgress({ done: 0, total: photos.length })
      const uploads = result.uploads || []
      const bookData = result.data as { id: string; title: string; access_url: string }
      const { registered, failedNames } = await uploadFilesToSignedUrls(uploads, photos, (done) =>
        setUploadProgress({ done, total: photos.length }),
      )

      if (registered.length === 0) {
        await fetch(`/api/admin/photo-books/${bookData.id}`, { method: 'DELETE' }).catch(() => null)
        throw new Error('No se pudo subir ninguna foto (¿problema de conexión?). No se guardó el book: intentá de nuevo.')
      }

      // 3. Registrar las subidas en la base.
      const registerResponse = await fetch(`/api/admin/photo-books/${bookData.id}/photos/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: registered }),
      })
      const registerResult = await safeJson(registerResponse)
      if (!registerResponse.ok) throw new Error(registerResult?.error || 'Las fotos se subieron pero no se pudieron registrar.')

      const qrDataUrl = await QRCode.toDataURL(bookData.access_url, { width: 360, margin: 2 })
      setShareModal({ title: bookData.title, url: bookData.access_url, qrDataUrl })
      setMessage(
        failedNames.length > 0
          ? {
              text: `Book creado con ${registered.length} fotos, pero ${failedNames.length} fallaron (${failedNames.join(', ')}). Reintentalas desde Editar.`,
              type: 'error',
            }
          : { text: 'Book creado y fotos cargadas correctamente.', type: 'success' },
      )
      resetForm()
      await fetchBooks()
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'No se pudo crear el book.', type: 'error' })
    } finally {
      setSaving(false)
      setUploadProgress(null)
    }
  }

  const saveBookDetails = async ({ showSuccessMessage = true } = {}) => {
    const editPeople = Number(editPeopleCount)
    if (!editBook || !editTitle.trim() || !editGuideName.trim() || !Number.isInteger(editPeople) || editPeople < 1 || !editTourDate) return false

    setEditing(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/photo-books/${editBook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          guide_name: editGuideName.trim(),
          people_count: editPeople,
          tour_date: editTourDate,
          description: editDescription.trim(),
        }),
      })
      const result = await safeJson(response)
      if (!response.ok || !result) throw new Error(result?.error || 'No se pudo actualizar el book.')

      updateBookInState(result.data as Book)
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
    try {
      // Mismo esquema que el alta: URLs firmadas → subida directa → registro.
      const urlsResponse = await fetch(`/api/admin/photo-books/${editBook.id}/photos/upload-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: morePhotos.map((photo) => ({ name: photo.name, type: photo.type, size: photo.size })) }),
      })
      const urlsResult = await safeJson(urlsResponse)
      if (!urlsResponse.ok || !urlsResult) throw new Error(urlsResult?.error || 'No se pudieron preparar las subidas.')

      setUploadProgress({ done: 0, total: morePhotos.length })
      const uploads = urlsResult.uploads || []
      const { registered, failedNames } = await uploadFilesToSignedUrls(uploads, morePhotos, (done) =>
        setUploadProgress({ done, total: morePhotos.length }),
      )
      if (registered.length === 0) {
        throw new Error('No se pudo subir ninguna foto (¿problema de conexión?). Intentá de nuevo.')
      }

      const response = await fetch(`/api/admin/photo-books/${editBook.id}/photos/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: registered }),
      })
      const result = await safeJson(response)
      if (!response.ok || !result) throw new Error(result?.error || 'No se pudieron registrar las fotos.')

      updateBookInState(result.data as Book)
      setMorePhotos([])
      await loadCurrentPhotoPreviews(editBook.id)
      if (failedNames.length > 0) {
        setMessage({ text: `${registered.length} fotos agregadas, pero ${failedNames.length} fallaron (${failedNames.join(', ')}). Reintentalas.`, type: 'error' })
        return false
      }
      if (showSuccessMessage) setMessage({ text: `${registered.length} fotos agregadas al book.`, type: 'success' })
      return true
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'No se pudieron agregar las fotos.', type: 'error' })
      return false
    } finally {
      setUploadingMore(false)
      setUploadProgress(null)
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

        {/* Sugerencias de guías ya cargados (evita el mismo nombre escrito de
            tres formas); la usan el form de alta y el modal de edición. */}
        <datalist id="guias-conocidas">
          {guideStats.map(([name]) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        {guideStats.length > 0 ? (
          <div className="table-container" style={{ marginBottom: 16, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>Recorridos por guía</strong>
              <span className="td-muted" style={{ fontSize: 12 }}>
                registro histórico: se conserva aunque los books venzan y se borren
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {guideStats.map(([name, stats]) => (
                <span key={name} className="badge" style={{ background: 'rgba(18,111,245,0.12)', color: '#126ff5' }}>
                  {name} · {stats.tours} {stats.tours === 1 ? 'recorrido' : 'recorridos'}
                  {stats.people > 0 ? ` · ${stats.people} personas` : ''}
                </span>
              ))}
            </div>
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
                <label>Recorrido *</label>
                <select className="select" value={titleChoice} onChange={(event) => setTitleChoice(event.target.value)} required>
                  <option value="">Elegí el circuito</option>
                  {circuitNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value={customTitleChoice}>Otro recorrido…</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fecha del recorrido *</label>
                <DateInput className="input" value={tourDate} onChange={(event) => setTourDate(event.target.value)} required />
              </div>
              {titleChoice === customTitleChoice ? (
                <div className="form-group">
                  <label>Nombre del recorrido *</label>
                  <input className="input" value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Ej. Recorrido especial 9 de Julio" required />
                </div>
              ) : null}
              <div className="form-group">
                <label>Detalle (opcional)</label>
                <input className="input" value={titleDetail} onChange={(event) => setTitleDetail(event.target.value)} placeholder="Ej. turno mañana" />
              </div>
              <div className="form-group">
                <label>Guía que hizo el recorrido *</label>
                <input
                  className="input"
                  list="guias-conocidas"
                  value={guideName}
                  onChange={(event) => setGuideName(event.target.value)}
                  placeholder="Nombre y apellido del guía"
                  required
                />
              </div>
              <div className="form-group">
                <label>Cantidad de personas que participaron *</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={500}
                  value={peopleCount}
                  onChange={(event) => setPeopleCount(event.target.value)}
                  placeholder="Ej. 25"
                  required
                />
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
              <button className="btn btn-primary" disabled={saving || !baseTitle || !guideName.trim() || !(Number(peopleCount) >= 1) || !tourDate || photos.length === 0}>
                {saving ? (
                  <>
                    <span className="spinner" />{' '}
                    {uploadProgress ? `Subiendo foto ${Math.min(uploadProgress.done + 1, uploadProgress.total)} de ${uploadProgress.total}...` : 'Creando book...'}
                  </>
                ) : (
                  'Crear book y generar QR'
                )}
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
                  {book.guide_name ? (
                    <p className="photo-book-date">
                      Guía: {book.guide_name}
                      {book.people_count ? ` · ${book.people_count} personas` : ''}
                    </p>
                  ) : null}
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
              <button className="btn btn-primary" onClick={saveAndCloseEditModal} disabled={editing || uploadingMore || !editTitle.trim() || !editGuideName.trim() || !(Number(editPeopleCount) >= 1) || !editTourDate}>
                {editing || uploadingMore ? (
                  <>
                    <span className="spinner" />{' '}
                    {uploadProgress ? `Subiendo ${Math.min(uploadProgress.done + 1, uploadProgress.total)}/${uploadProgress.total}...` : 'Guardando...'}
                  </>
                ) : (
                  <><Save size={15} /> Guardar y salir</>
                )}
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
                    <label>Guía que hizo el recorrido *</label>
                    <input
                      className="input"
                      list="guias-conocidas"
                      value={editGuideName}
                      onChange={(event) => setEditGuideName(event.target.value)}
                      placeholder="Nombre y apellido del guía"
                    />
                  </div>
                  <div className="form-group">
                    <label>Cantidad de personas *</label>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={500}
                      value={editPeopleCount}
                      onChange={(event) => setEditPeopleCount(event.target.value)}
                      placeholder="Ej. 25"
                    />
                  </div>
                  <div className="form-group">
                    <label>Fecha *</label>
                    <DateInput className="input" value={editTourDate} onChange={(event) => setEditTourDate(event.target.value)} />
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

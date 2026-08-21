import Link from 'next/link'
import { Camera, CalendarDays, ChevronLeft, Images } from 'lucide-react'
import GalleryBackground from './GalleryBackground'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import styles from './gallery-index.module.css'

interface PublicBook {
  id: string
  title: string
  tour_date: string
  description: string | null
  access_token: string
  expires_at: string
  photo_book_photos: Array<{ id: string; storage_path: string; sort_order: number }>
}

export const dynamic = 'force-dynamic'

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha = '' } = await searchParams
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : ''
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('photo_books')
    .select('id, title, tour_date, description, access_token, expires_at, photo_book_photos(id, storage_path, sort_order)')
    .gt('expires_at', new Date().toISOString())
    .order('tour_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (selectedDate) query = query.eq('tour_date', selectedDate)

  const { data, error } = await query
  const books = (data || []) as PublicBook[]
  const backgroundPaths = books
    .flatMap((book) => [...book.photo_book_photos].sort((a, b) => a.sort_order - b.sort_order))
    .slice(0, 6)
    .map((photo) => photo.storage_path)

  const backgroundImages = backgroundPaths.length
    ? (await Promise.all(backgroundPaths.map(async (path) => {
        const { data: signed } = await supabase.storage.from(PHOTO_BOOK_BUCKET).createSignedUrl(path, 60 * 60)
        return signed?.signedUrl || ''
      }))).filter(Boolean)
    : ['/bus2.jpg']

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logoMuni-sm.png" alt="Municipalidad de San Miguel de Tucumán" />
          <span><strong>Bus Turístico</strong><small>Galería de recorridos</small></span>
        </Link>
        <Link href="/" className={styles.back}><ChevronLeft size={17} /> Volver al inicio</Link>
      </header>

      <section className={styles.hero}>
        <GalleryBackground images={backgroundImages.length ? backgroundImages : ['/bus2.jpg']} />
        <div className={styles.heroContent}>
        <div className={styles.heroIcon}><Camera size={30} /></div>
        <p className={styles.eyebrow}>Fotos de tu experiencia</p>
        <h1>Encontrá las fotos de tu recorrido</h1>
        <p>Seleccioná el día en que realizaste la excursión. Las fotos permanecen disponibles durante 7 días.</p>

        <form className={styles.search} action="/galeria" method="get">
          <label htmlFor="fecha"><CalendarDays size={18} /> Fecha del recorrido</label>
          <div>
            <input id="fecha" name="fecha" type="date" defaultValue={selectedDate} required />
            <button type="submit">Buscar fotos</button>
          </div>
        </form>
        </div>
      </section>

      <section className={styles.results}>
        <div className={styles.resultsHeader}>
          <div>
            <h2>{selectedDate ? 'Recorridos de la fecha seleccionada' : 'Galerías disponibles'}</h2>
            <p>{selectedDate ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date(`${selectedDate}T12:00:00`)) : 'También podés elegir una fecha para encontrar tu recorrido.'}</p>
          </div>
          {selectedDate ? <Link href="/galeria" className={styles.clear}>Ver todas</Link> : null}
        </div>

        {error ? (
          <div className={styles.empty}><Images size={42} /><h3>La galería todavía no está habilitada</h3><p>El administrador debe completar la configuración de fotos.</p></div>
        ) : books.length === 0 ? (
          <div className={styles.empty}><Images size={42} /><h3>No encontramos fotos disponibles</h3><p>{selectedDate ? 'Revisá la fecha o consultá nuevamente más tarde.' : 'Todavía no se publicaron recorridos vigentes.'}</p></div>
        ) : (
          <div className={styles.grid}>
            {books.map((book) => (
              <article className={styles.card} key={book.id}>
                <div className={styles.cardVisual}><Camera size={34} /><span>{book.photo_book_photos.length} fotos</span></div>
                <div className={styles.cardBody}>
                  <p className={styles.date}>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date(`${book.tour_date}T12:00:00`))}</p>
                  <h3>{book.title}</h3>
                  {book.description ? <p className={styles.description}>{book.description}</p> : null}
                  <Link href={`/fotos/${book.access_token}`} className={styles.open}>Ver mis fotos</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className={styles.footer}>Municipalidad de San Miguel de Tucumán</footer>
    </main>
  )
}

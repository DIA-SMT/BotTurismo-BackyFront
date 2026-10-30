import Link from 'next/link'
import { Camera, CalendarDays, ChevronLeft, Images } from 'lucide-react'
import GalleryBackground from './GalleryBackground'
import { DateInput } from '@/components/DateInput'
import { createSignedReadUrl } from '@/lib/archivos'
import { getSql } from '@/lib/db'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'
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
  const sql = getSql()

  let books: PublicBook[] = []
  let error: unknown = null
  try {
    books = await sql<PublicBook[]>`
      select b.id, b.title, b.tour_date, b.description, b.access_token, b.expires_at,
        coalesce((
          select json_agg(json_build_object('id', p.id, 'storage_path', p.storage_path, 'sort_order', p.sort_order) order by p.sort_order, p.created_at)
          from photo_book_photos p
          where p.book_id = b.id
        ), '[]'::json) as photo_book_photos
      from photo_books b
      where b.expires_at > ${new Date().toISOString()}
        ${selectedDate ? sql`and b.tour_date = ${selectedDate}` : sql``}
      order by b.tour_date desc, b.created_at desc
    `
  } catch (queryError) {
    error = queryError
  }
  const backgroundPaths = books
    .flatMap((book) => [...book.photo_book_photos].sort((a, b) => a.sort_order - b.sort_order))
    .slice(0, 6)
    .map((photo) => photo.storage_path)

  const backgroundImages = backgroundPaths.length
    ? backgroundPaths.map((path) => {
        try {
          return createSignedReadUrl(PHOTO_BOOK_BUCKET, path, 60 * 60)
        } catch {
          return ''
        }
      }).filter(Boolean)
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
            <DateInput id="fecha" name="fecha" defaultValue={selectedDate} required />
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

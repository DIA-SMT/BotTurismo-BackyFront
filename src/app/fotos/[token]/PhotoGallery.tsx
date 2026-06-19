'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, Download, Home, Images, X } from 'lucide-react'
import styles from './gallery.module.css'

interface GalleryData {
  title: string
  tour_date: string
  description: string | null
  expires_at: string
  photos: Array<{ id: string; name: string; view_url: string; download_url: string }>
}

export default function PhotoGallery({ token }: { token: string }) {
  const [data, setData] = useState<GalleryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<GalleryData['photos'][number] | null>(null)
  const [backgroundIndex, setBackgroundIndex] = useState(0)

  useEffect(() => {
    fetch(`/api/photo-books/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'No se pudo abrir el book.')
        setData(result.data)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo abrir el book.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!data || data.photos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timer = window.setInterval(() => {
      setBackgroundIndex((current) => (current + 1) % Math.min(data.photos.length, 6))
    }, 6500)

    return () => window.clearInterval(timer)
  }, [data])

  if (loading) return <main className={styles.state}><span className="spinner" /> Cargando fotos...</main>
  if (error || !data) {
    return <main className={styles.state}><h1>Book no disponible</h1><p>{error}</p><p>El enlace puede haber vencido. Los books se conservan durante 7 días.</p></main>
  }

  return (
    <main className={styles.page}>
      <nav className={styles.topNav} aria-label="Navegación de la galería">
        <a href="/galeria"><ChevronLeft size={17} /> Volver a la galería</a>
        <a href="/"><Home size={16} /> Ir al inicio</a>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroBackground} aria-hidden="true">
          {data.photos.slice(0, 6).map((photo, index) => (
            <div
              key={photo.id}
              className={`${styles.heroBackgroundSlide} ${index === backgroundIndex ? styles.heroBackgroundSlideActive : ''}`}
              style={{ backgroundImage: `url("${photo.view_url}")` }}
            />
          ))}
          <div className={styles.heroBackgroundShade} />
        </div>
        <div className={styles.heroContent}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logoMuni-sm.png" alt="Municipalidad de San Miguel de Tucumán" />
        <p className={styles.eyebrow}>Recuerdos del Bus Turístico</p>
        <h1>{data.title}</h1>
        <p>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date(`${data.tour_date}T12:00:00`))}</p>
        {data.description ? <p className={styles.description}>{data.description}</p> : null}
        <p className={styles.expiry}>Disponible hasta el {new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' }).format(new Date(data.expires_at))}</p>
        </div>
      </header>

      <section className={styles.gallery} aria-label="Fotos del recorrido">
        {data.photos.map((photo, index) => (
          <article className={styles.photoCard} key={photo.id}>
            <button onClick={() => setSelected(photo)} aria-label={`Ampliar foto ${index + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.view_url} alt={`Foto ${index + 1} del recorrido`} loading="lazy" />
            </button>
            <a href={photo.download_url} className={styles.download}><Download size={17} /> Descargar</a>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>
        <Images size={16} />
        Municipalidad de San Miguel de Tucumán
      </footer>

      {selected ? (
        <div className={styles.lightbox} onClick={(event) => event.target === event.currentTarget && setSelected(null)}>
          <button className={styles.close} onClick={() => setSelected(null)} aria-label="Cerrar"><X /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.view_url} alt="Foto ampliada" />
          <a href={selected.download_url} className={styles.lightboxDownload}><Download size={18} /> Descargar foto</a>
        </div>
      ) : null}
    </main>
  )
}

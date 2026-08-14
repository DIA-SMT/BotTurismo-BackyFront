import type { Metadata } from 'next'
import Link from 'next/link'
import { Bus, GraduationCap } from 'lucide-react'
import styles from './landing.module.css'
import { LandingHeroBackground } from '@/components/landing/LandingHeroBackground'

export const metadata: Metadata = {
  title: 'Bus Turístico de San Miguel de Tucumán',
  description:
    'Elegí tu experiencia: Bus Turístico con salidas programadas para turistas y vecinos, o Bus Educativo con turnos institucionales para escuelas.',
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <LandingHeroBackground variant="split" />
      <div className={styles.overlay} />

      <header className={styles.topBar}>
        <Link href="/" className={styles.brand} aria-label="Bus Turístico de San Miguel de Tucumán">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logoMuni-sm.png" alt="" className={styles.brandLogo} />
          <span className={styles.brandText}>
            <span>Ciudad</span>
            <strong>San Miguel de Tucumán</strong>
          </span>
        </Link>

        <nav className={styles.topLinks} aria-label="Enlaces">
          <a href="/galeria">Galería</a>
          <a href="/login">Iniciar sesión</a>
        </nav>
      </header>

      <section className={styles.content}>
        <p className={styles.eyebrow}>Bus Turístico Municipal</p>
        <h1 className={styles.title}>¿Cómo querés recorrer la ciudad?</h1>
        <p className={styles.lead}>
          Descubrí San Miguel de Tucumán desde su historia, su arte y su gente. Elegí la experiencia que buscás para
          continuar.
        </p>

        <div className={styles.choiceGrid}>
          <Link href="/turistico" className={`${styles.choiceCard} ${styles.choiceCardTourist}`}>
            <span className={styles.choiceIcon}>
              <Bus size={26} strokeWidth={1.9} />
            </span>
            <h2 className={styles.choiceTitle}>Bus Turístico</h2>
            <p className={styles.choiceText}>
              Para turistas y vecinos. Circuitos guiados por la ciudad con salidas programadas y reserva gratuita.
            </p>
            <ul className={styles.choiceList}>
              <li>Salidas con fecha, hora y cupos en tiempo real</li>
              <li>Circuitos diurnos, nocturnos y gastronómicos</li>
              <li>Información disponible en español e inglés</li>
            </ul>
            <span className={styles.choiceCta}>Reservar lugar →</span>
          </Link>

          <Link href="/educativo" className={`${styles.choiceCard} ${styles.choiceCardEducational}`}>
            <span className={styles.choiceIcon}>
              <GraduationCap size={26} strokeWidth={1.9} />
            </span>
            <h2 className={styles.choiceTitle}>Bus Educativo</h2>
            <p className={styles.choiceText}>
              Para escuelas e instituciones. Turnos de lunes a viernes con solicitud institucional y acompañamiento
              pedagógico.
            </p>
            <ul className={styles.choiceList}>
              <li>Circuito Histórico Cultural por los museos municipales</li>
              <li>Turnos de mañana y tarde según disponibilidad</li>
              <li>Solicitud con nota institucional</li>
            </ul>
            <span className={styles.choiceCta}>Solicitar turno →</span>
          </Link>
        </div>

        <p className={styles.footerNote}>
          Oficina de Informes Turísticos · Peatonal Congreso 121 · Lunes a viernes de 8 a 13 h y de 16 a 21 h · Sábados,
          domingos y feriados de 9 a 20 h.
        </p>
      </section>
    </main>
  )
}

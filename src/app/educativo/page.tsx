import type { Metadata } from 'next'
import styles from '@/components/educational-bus/form.module.css'
import { EducationalBusRequestForm } from '@/components/educational-bus/EducationalBusRequestForm'
import { CircuitInfoAccordionGroup } from '@/components/educational-bus/HistoricalCircuitAccordion'
import { PriorityNotice } from '@/components/educational-bus/PriorityNotice'
import { HeroMedia } from '@/components/educational-bus/HeroMedia'
import { MouseExperience } from '@/components/MouseExperience'
import { educationalBusTemplateLabel, educationalBusTemplatePublicPath } from '@/lib/educational-bus-requests'
import { buildEducationalCircuitSeedRows } from '@/lib/educational-circuits'
import { getActiveEducationalCircuits } from '@/lib/educational-circuits-server'
import { getEducationalSettings } from '@/lib/educational-settings-server'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export const metadata: Metadata = {
  title: 'Bus Educativo | San Miguel de Tucumán',
  description:
    'Solicitá un turno institucional para recorrer San Miguel de Tucumán en el Bus Turístico Educativo. Turnos de lunes a viernes para escuelas e instituciones.',
}

// El contenido de los circuitos sale del catálogo administrable.
export const dynamic = 'force-dynamic'

interface AccordionItem {
  id: string
  iconName: 'landmark'
  title: string
  summary: string
  paragraphs: string[]
}

async function loadCircuitAccordionItems(): Promise<AccordionItem[]> {
  try {
    const circuits = await getActiveEducationalCircuits(createServerSupabaseClient())
    if (circuits.length > 0) {
      return circuits.map((circuit) => ({
        id: circuit.slug,
        iconName: 'landmark' as const,
        title: circuit.name.startsWith('Circuito') ? circuit.name : `Circuito ${circuit.name}`,
        summary: circuit.summary,
        paragraphs: circuit.paragraphs,
      }))
    }
  } catch {
    // Migración pendiente: se muestra el contenido de la semilla.
  }

  return buildEducationalCircuitSeedRows()
    .filter((row) => row.active)
    .map((row) => ({
      id: row.slug,
      iconName: 'landmark' as const,
      title: row.name.startsWith('Circuito') ? row.name : `Circuito ${row.name}`,
      summary: row.summary,
      paragraphs: row.paragraphs,
    }))
}

export default async function EducationalBusPage() {
  const [circuitItems, settings] = await Promise.all([
    loadCircuitAccordionItems(),
    getEducationalSettings(createServerSupabaseClient()),
  ])
  const requestsOpen = settings.publicRequestsEnabled
  return (
    <main className={styles.page}>
      <MouseExperience />
      <header className={styles.header}>
        <a className={styles.brand} href="#inicio" aria-label="Ir al inicio">
          <span className={styles.muniBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logoMuni-sm.png" alt="" className={styles.brandLogo} />
            <span className={styles.muniText}>
              <span>Ciudad</span>
              <strong>San Miguel</strong>
              <strong>de Tucumán</strong>
            </span>
          </span>
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.productBrand}>
            <span className={styles.brandTitle}>Bus Educativo</span>
          </span>
        </a>

        <nav className={styles.nav} aria-label="Navegación principal">
          {requestsOpen ? <a href="#solicitud">Reservar turno</a> : null}
          <a href="#circuitos">Circuitos</a>
          <a href="/turistico">Bus turístico</a>
          <a href="/galeria">Galería</a>
          <a href="/login">Iniciar sesión</a>
        </nav>

        {requestsOpen ? (
          <a className={styles.headerAction} href="#solicitud">
            Solicitar turno
          </a>
        ) : null}
      </header>

      <section id="inicio" className={styles.hero}>
        <HeroMedia />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Turismo educativo municipal</p>
          <h1 className={styles.heroTitle}>Reservá una experiencia educativa por la ciudad</h1>
          <p className={styles.heroLead}>
            Solicitá un turno institucional para recorrer San Miguel de Tucumán en el Bus Turístico Educativo.
          </p>
          <div className={styles.heroActions}>
            {requestsOpen ? (
              <a className={styles.primaryCta} href="#solicitud">
                Solicitar turno
              </a>
            ) : null}
            <a className={styles.secondaryCta} href="#circuitos">
              Ver circuitos
            </a>
            {requestsOpen ? null : (
              <a className={styles.secondaryCta} href="/turistico">
                Ir al Bus Turístico
              </a>
            )}
          </div>
        </div>
      </section>

      <div className={styles.assuranceBar}>
        <span>Servicio educativo municipal</span>
        <strong>
          {requestsOpen
            ? 'Turnos sujetos a cupo, prioridad y disponibilidad'
            : 'Las solicitudes online están momentáneamente deshabilitadas'}
        </strong>
      </div>

      <div className={styles.shell}>
        {requestsOpen ? (
          <section id="solicitud" className={styles.layoutSplit}>
            <EducationalBusRequestForm />
            <aside className={styles.sideStack} id="circuitos">
              <section className={styles.sideCard}>
                <p className={styles.sideTitle}>Antes de enviar</p>
                <ul className={styles.infoList}>
                  <li>Elegí una fecha para ver los turnos disponibles.</li>
                  <li>Completá los datos de contacto.</li>
                  <li>Adjuntá la nota modelo en .docx.</li>
                </ul>
                <a href={educationalBusTemplatePublicPath} download className={styles.templateLink} style={{ marginTop: 18 }}>
                  {educationalBusTemplateLabel}
                </a>
              </section>
              <PriorityNotice />
              <CircuitInfoAccordionGroup items={circuitItems} />
              <section className={styles.sideCard}>
                <p className={styles.sideTitle}>Qué sucede después</p>
                <p className={styles.sideText}>La solicitud será evaluada según cupo, prioridad y disponibilidad. El equipo podrá confirmar, pedir información o proponer otra fecha.</p>
                <p className={styles.sideText}>Si necesitás cancelar un turno confirmado, avisá con 48 horas de anticipación a turismo@smt.gob.ar.</p>
              </section>
            </aside>
          </section>
        ) : (
          <section className={styles.layoutSplit} style={{ gridTemplateColumns: '1fr', maxWidth: 720, margin: '0 auto' }}>
            <section className={styles.sideCard} style={{ textAlign: 'center' }}>
              <p className={styles.sideTitle}>Solicitudes momentáneamente deshabilitadas</p>
              <p className={styles.sideText}>
                El formulario de turnos para escuelas e instituciones no está disponible por estos días. Muy pronto vamos
                a volver a recibir solicitudes online.
              </p>
              <p className={styles.sideText}>
                Por consultas o turnos ya confirmados, escribinos a{' '}
                <a href="mailto:turismo@smt.gob.ar" style={{ color: '#126ff5', fontWeight: 700 }}>
                  turismo@smt.gob.ar
                </a>{' '}
                o acercate a la Oficina de Informes Turísticos (Congreso de Tucumán 141).
              </p>
            </section>
            <aside className={styles.sideStack} id="circuitos">
              <CircuitInfoAccordionGroup items={circuitItems} />
            </aside>
          </section>
        )}
      </div>
    </main>
  )
}

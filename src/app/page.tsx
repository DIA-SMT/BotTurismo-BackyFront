import styles from '@/components/educational-bus/form.module.css'
import { EducationalBusRequestForm } from '@/components/educational-bus/EducationalBusRequestForm'
import { CircuitInfoAccordionGroup } from '@/components/educational-bus/HistoricalCircuitAccordion'
import { PriorityNotice } from '@/components/educational-bus/PriorityNotice'
import { educationalBusTemplateLabel, educationalBusTemplatePublicPath } from '@/lib/educational-bus-requests'

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#inicio" aria-label="Ir al inicio">
          <span className={styles.muniBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-muni.jpeg" alt="" className={styles.brandLogo} />
            <span className={styles.muniText}>
              <span>Ciudad</span>
              <strong>San Miguel</strong>
              <strong>de Tucumán</strong>
            </span>
          </span>
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.productBrand}>
            <span className={styles.brandTitle}>Bus Turístico Educativo</span>
          </span>
        </a>

        <nav className={styles.nav} aria-label="Navegación principal">
          <a href="#solicitud">Reservar turno</a>
          <a href="#circuitos">Circuitos</a>
          <a href="/login">Iniciar sesión</a>
        </nav>

        <a className={styles.headerAction} href="#solicitud">
          Solicitar turno
        </a>
      </header>

      <section id="inicio" className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing-hero-bus.png" alt="" className={styles.heroImage} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Turismo educativo municipal</p>
          <h1 className={styles.heroTitle}>Reservá una experiencia educativa por la ciudad</h1>
          <p className={styles.heroLead}>
            Solicitá un turno institucional para recorrer San Miguel de Tucumán en el Bus Turístico Educativo.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryCta} href="#solicitud">
              Solicitar turno
            </a>
            <a className={styles.secondaryCta} href="#circuitos">
              Ver circuitos
            </a>
          </div>
        </div>
      </section>

      <div className={styles.assuranceBar}>
        <span>Servicio educativo municipal</span>
        <strong>Turnos sujetos a cupo, prioridad y disponibilidad</strong>
      </div>

      <div className={styles.shell}>
        <section className={styles.cityPrompt} aria-label="Circuitos disponibles">
          <p>Elegí el recorrido educativo para tu institución</p>
          <div className={styles.circuitPreviewGrid}>
            <a className={styles.circuitPreviewCard} href="#solicitud">
              <span>Circuito Histórico Cultural</span>
            </a>
            <a className={styles.circuitPreviewCard} href="#solicitud">
              <span>Circuito de la Memoria</span>
            </a>
          </div>
        </section>

        <section id="solicitud" className={styles.layoutSplit}>
          <EducationalBusRequestForm />
          <aside className={styles.sideStack} id="circuitos">
            <section className={styles.sideCard}>
              <p className={styles.sideTitle}>Antes de enviar</p>
              <ul className={styles.infoList}>
                <li>Elegí el circuito para ver turnos disponibles.</li>
                <li>Completá los datos de contacto.</li>
                <li>Adjuntá la nota modelo en .docx.</li>
              </ul>
              <a href={educationalBusTemplatePublicPath} download className={styles.templateLink} style={{ marginTop: 18 }}>
                {educationalBusTemplateLabel}
              </a>
            </section>
            <PriorityNotice />
            <CircuitInfoAccordionGroup
              items={[
                {
                  id: 'historico-cultural',
                  iconName: 'landmark',
                  title: 'Circuito Histórico Cultural',
                  summary: 'Historia, cultura e identidad tucumana.',
                  paragraphs: [
                    'El presente circuito histórico-cultural propone un recorrido por espacios emblemáticos de la ciudad de San Miguel de Tucumán que permiten comprender la identidad local a través de su historia, su cultura y su desarrollo productivo.',
                    'A lo largo del itinerario, los visitantes podrán conocer distintos aspectos que conforman el patrimonio tucumano, desde su pasado industrial hasta sus expresiones artísticas y su legado histórico nacional.',
                    'El recorrido incluye la visita al Museo de la Industria Azucarera, la Casa Natal de Mercedes Sosa, el Museo Casa de la Ciudad y la Casa Solar Belgraniana, articulando turismo, educación y patrimonio en una propuesta integral.',
                    'Esta experiencia permite no solo recorrer espacios significativos, sino también reflexionar sobre la construcción de la identidad tucumana y la importancia de preservar ese legado para las futuras generaciones.',
                  ],
                },
                {
                  id: 'memoria',
                  iconName: 'users',
                  title: 'Circuito de la Memoria',
                  summary: 'Historia reciente y luchas sociales.',
                  paragraphs: [
                    'Historia de los trabajadores. A través del recorrido por algunas calles de esta ciudad, intentaremos identificar algunos de los procesos y actores significativos de nuestra historia reciente.',
                    'La particularidad de este recorrido reside en que los lugares que visitaremos son emblemáticos o simbólicos de procesos mucho más grandes. Desde aquí buscamos reconstruir la historia de Tucumán a partir de la organización de los trabajadores, las grandes luchas y eventos que sucedieron.',
                    'El objetivo de este circuito es conmemorar en 2026 los 50 años del Golpe de Estado de 1976 y los 60 años del cierre de los Ingenios Azucareros, dos hechos trascendentales que marcaron la historia de nuestro país y de la provincia.',
                    'Este circuito está destinado a los 3 últimos años de la escuela secundaria y requiere una clase introductoria previa sobre el tema a cargo de la institución educativa para permitir una mejor comprensión de los contenidos.',
                  ],
                },
              ]}
            />
            <section className={styles.sideCard}>
              <p className={styles.sideTitle}>Qué sucede después</p>
              <p className={styles.sideText}>La solicitud será evaluada según cupo, prioridad y disponibilidad. El equipo podrá confirmar, pedir información o proponer otra fecha.</p>
              <p className={styles.sideText}>Si necesitás cancelar un turno confirmado, avisá con 48 horas de anticipación a turismo@smt.gob.ar.</p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}

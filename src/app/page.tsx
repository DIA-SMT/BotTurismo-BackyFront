import styles from '@/components/educational-bus/form.module.css'
import { EducationalBusRequestForm } from '@/components/educational-bus/EducationalBusRequestForm'
import { CircuitInfoAccordionGroup } from '@/components/educational-bus/HistoricalCircuitAccordion'
import { PriorityNotice } from '@/components/educational-bus/PriorityNotice'
import { educationalBusTemplateLabel, educationalBusTemplatePublicPath } from '@/lib/educational-bus-requests'

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandLogoWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Logo%20SMT%20blanco%402x.png" alt="Ciudad SMT" className={styles.brandLogo} />
            </div>
            <div>
              <p className={styles.brandTitle}>Bus Turístico Educativo</p>
              <p className={styles.brandText}>Completá el formulario para solicitar un turno institucional.</p>
            </div>
          </div>
        </header>

        <section className={styles.layoutSplit}>
          <EducationalBusRequestForm />
          <div className={styles.sideStack}>
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
          </div>
        </section>
      </div>
    </main>
  )
}

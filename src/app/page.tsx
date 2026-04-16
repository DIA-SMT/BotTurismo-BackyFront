import { CalendarRange, School, ShieldCheck } from 'lucide-react'
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
              <p className={styles.brandText}>Solicitud de turnos para visitas educativas de instituciones de San Miguel de Tucumán.</p>
            </div>
          </div>
        </header>

        <section className={styles.heroGrid}>
          <article className={styles.heroCard}>
            <span className={styles.eyebrow}>
              <CalendarRange size={16} />
              Solicitud digital de turnos
            </span>
            <h1 className={styles.heroTitle}>Solicitá un turno para que tu institución participe del Bus Turístico Educativo.</h1>
            <p className={styles.heroLead}>
              Completá el formulario con los datos de la institución, la fecha deseada, el circuito solicitado y la información del grupo. La solicitud será evaluada según disponibilidad y criterios de prioridad.
            </p>

            <div className={styles.heroStats}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>
                  <School size={20} />
                </div>
                <p className={styles.statLabel}>Pensado para escuelas y otras instituciones educativas que deseen organizar una visita.</p>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>
                  <ShieldCheck size={20} />
                </div>
                <p className={styles.statLabel}>Circuitos, días y turnos guiados por disponibilidad para evitar combinaciones inválidas.</p>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>1 paso</div>
                <p className={styles.statLabel}>Completá la solicitud con los datos de la institución, el grupo, el circuito y la fecha deseada.</p>
              </div>
            </div>
          </article>

          <div className={styles.sideStack}>
            <PriorityNotice />
            <section className={styles.sideCard}>
              <p className={styles.sideTitle}>Antes de enviar</p>
              <p className={styles.sideText}>Tené a mano la fecha tentativa, el circuito que querés solicitar, la cantidad estimada de alumnos, los datos de contacto del responsable institucional y la nota modelo completa en formato .docx.</p>
              <ul className={styles.infoList}>
                <li>Elegí el circuito primero para conocer qué días y turnos están disponibles.</li>
                <li>Descargá, completá y adjuntá la nota modelo junto con el formulario.</li>
                <li>Completá correctamente los datos de contacto para facilitar la comunicación.</li>
                <li>Usá el campo de observaciones si el grupo necesita información o asistencia especial.</li>
              </ul>
              <a href={educationalBusTemplatePublicPath} download className={styles.templateLink} style={{ marginTop: 18 }}>
                {educationalBusTemplateLabel}
              </a>
            </section>
          </div>
        </section>

        <section className={styles.layoutSplit}>
          <EducationalBusRequestForm />
          <div className={styles.sideStack}>
            <CircuitInfoAccordionGroup
              items={[
                {
                  id: 'historico-cultural',
                  iconName: 'landmark',
                  title: 'Circuito Histórico Cultural',
                  summary: 'Recorrido por espacios emblemáticos que conectan historia, cultura, industria e identidad tucumana.',
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
                  summary: 'Historia reciente, trabajadores y luchas sociales en Tucumán, con eje en las conmemoraciones de 2026.',
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
              <p className={styles.sideText}>Una vez enviada, la solicitud queda registrada para su evaluación. El equipo responsable podrá confirmar el turno, pedir información adicional o proponer una reprogramación si fuera necesario.</p>
              <ul className={styles.infoList}>
                <li>La recepción de la solicitud no implica confirmación automática del turno.</li>
                <li>La asignación dependerá del cupo disponible y la prioridad correspondiente.</li>
                <li>Es importante revisar periódicamente los canales de contacto informados.</li>
              </ul>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

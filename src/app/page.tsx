import { CalendarRange, School, ShieldCheck } from 'lucide-react'
import styles from '@/components/educational-bus/form.module.css'
import { EducationalBusRequestForm } from '@/components/educational-bus/EducationalBusRequestForm'
import { PriorityNotice } from '@/components/educational-bus/PriorityNotice'

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
              Completá el formulario con los datos de la institución, la fecha deseada y la información del grupo. La solicitud será evaluada por el programa según disponibilidad y criterios de prioridad.
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
                <p className={styles.statLabel}>Formulario claro, validado y fácil de completar desde computadora o celular.</p>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>1 paso</div>
                <p className={styles.statLabel}>Completá la solicitud en un solo formulario con los datos de la institución, el grupo y la fecha deseada.</p>
              </div>
            </div>
          </article>

          <div className={styles.sideStack}>
            <PriorityNotice />
            <section className={styles.sideCard}>
              <p className={styles.sideTitle}>Antes de enviar</p>
              <p className={styles.sideText}>Tené a mano la fecha tentativa, la cantidad estimada de alumnos y los datos de contacto del responsable institucional.</p>
              <ul className={styles.infoList}>
                <li>Indicá una fecha tentativa y el turno preferido para la visita.</li>
                <li>Completá correctamente los datos de contacto para facilitar la comunicación.</li>
                <li>Usá el campo de observaciones si el grupo necesita información o asistencia especial.</li>
              </ul>
            </section>
          </div>
        </section>

        <section className={styles.layoutSplit}>
          <EducationalBusRequestForm />
          <div className={styles.sideStack}>
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

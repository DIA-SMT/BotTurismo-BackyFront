import styles from './form.module.css'

export function PriorityNotice() {
  return (
    <section className={styles.sideCard}>
      <p className={styles.sideTitle}>Prioridad de asignación</p>
      <p className={styles.sideText}>Las solicitudes se evalúan según cupo, recorrido disponible y prioridad institucional.</p>
      <div className={styles.priorityList}>
        <div className={styles.priorityItem}>
          <div className={styles.priorityRank}>1</div>
          <div>
            <strong>Escuelas municipales</strong>
            <p className={styles.sideText}>Hasta 4° grado, con prioridad operativa en la asignación.</p>
          </div>
        </div>
        <div className={styles.priorityItem}>
          <div className={styles.priorityRank}>2</div>
          <div>
            <strong>Escuelas provinciales</strong>
            <p className={styles.sideText}>Se consideran luego de cubrir el segmento municipal prioritario.</p>
          </div>
        </div>
        <div className={styles.priorityItem}>
          <div className={styles.priorityRank}>3</div>
          <div>
            <strong>Instituciones privadas</strong>
            <p className={styles.sideText}>Quedan sujetas a disponibilidad y evaluación del programa.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

import styles from './form.module.css'

export function PriorityNotice() {
  return (
    <section className={styles.sideCard}>
      <p className={styles.sideTitle}>Prioridad de asignación</p>
      <div className={styles.priorityList}>
        <div className={styles.priorityItem}>
          <div className={styles.priorityRank}>1</div>
          <div>
            <strong>Escuelas municipales</strong>
          </div>
        </div>
        <div className={styles.priorityItem}>
          <div className={styles.priorityRank}>2</div>
          <div>
            <strong>Escuelas provinciales</strong>
          </div>
        </div>
        <div className={styles.priorityItem}>
          <div className={styles.priorityRank}>3</div>
          <div>
            <strong>Instituciones privadas</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

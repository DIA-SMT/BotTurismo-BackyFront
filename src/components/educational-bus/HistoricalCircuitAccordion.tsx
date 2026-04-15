'use client'

import { useState } from 'react'
import { ChevronDown, Landmark } from 'lucide-react'
import styles from './form.module.css'

export function HistoricalCircuitAccordion() {
  const [open, setOpen] = useState(false)

  return (
    <section className={styles.sideCard}>
      <button type="button" className={styles.accordionTrigger} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className={styles.accordionTitleWrap}>
          <span className={styles.accordionIcon}>
            <Landmark size={18} />
          </span>
          <span>
            <span className={styles.sideTitle}>Circuito Histórico Cultural</span>
            <span className={styles.accordionSummary}>Recorrido por espacios emblemáticos que conectan historia, cultura, industria e identidad tucumana.</span>
          </span>
        </span>
        <ChevronDown size={18} className={`${styles.accordionChevron} ${open ? styles.accordionChevronOpen : ''}`.trim()} />
      </button>

      <div className={`${styles.accordionBody} ${open ? styles.accordionBodyOpen : ''}`.trim()}>
        <div>
          <p className={styles.sideText}>
            El presente circuito histórico-cultural propone un recorrido por espacios emblemáticos de la ciudad de San Miguel de Tucumán que permiten comprender la identidad local a través de su historia, su cultura y su desarrollo productivo.
          </p>
          <p className={styles.sideText}>
            A lo largo del itinerario, los visitantes podrán conocer distintos aspectos que conforman el patrimonio tucumano, desde su pasado industrial hasta sus expresiones artísticas y su legado histórico nacional.
          </p>
          <p className={styles.sideText}>
            El recorrido incluye la visita al Museo de la Industria Azucarera, la Casa Natal de Mercedes Sosa, el Museo Casa de la Ciudad y la Casa Solar Belgraniana, articulando turismo, educación y patrimonio en una propuesta integral.
          </p>
          <p className={styles.sideText}>
            Esta experiencia permite no solo recorrer espacios significativos, sino también reflexionar sobre la construcción de la identidad tucumana y la importancia de preservar ese legado para las futuras generaciones.
          </p>
        </div>
      </div>
    </section>
  )
}

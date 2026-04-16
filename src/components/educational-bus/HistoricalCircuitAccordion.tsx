'use client'

import { useState } from 'react'
import { ChevronDown, Landmark, UsersRound } from 'lucide-react'
import styles from './form.module.css'

interface CircuitInfoAccordionProps {
  title: string
  summary: string
  paragraphs: string[]
  iconName?: 'landmark' | 'users'
}

interface CircuitInfoAccordionGroupProps {
  items: Array<CircuitInfoAccordionProps & { id: string }>
  groupTitle?: string
}

function CircuitInfoAccordionItem({
  title,
  summary,
  paragraphs,
  iconName = 'landmark',
}: CircuitInfoAccordionProps) {
  const [open, setOpen] = useState(false)
  const Icon = iconName === 'users' ? UsersRound : Landmark
  const actionLabel = open ? 'Ver menos' : 'Ver más'

  return (
    <article className={styles.accordionItem}>
      <button type="button" className={styles.accordionTrigger} onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className={styles.accordionTitleWrap}>
          <span className={styles.accordionIcon}>
            <Icon size={18} />
          </span>
          <span>
            <span className={styles.sideTitle}>{title}</span>
            <span className={styles.accordionSummary}>{summary}</span>
          </span>
        </span>
        <span className={styles.accordionAction}>
          <span className={styles.accordionActionLabel}>{actionLabel}</span>
          <ChevronDown size={18} className={`${styles.accordionChevron} ${open ? styles.accordionChevronOpen : ''}`.trim()} />
        </span>
      </button>

      <div className={`${styles.accordionBody} ${open ? styles.accordionBodyOpen : ''}`.trim()}>
        <div>
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className={styles.sideText}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </article>
  )
}

export function CircuitInfoAccordionGroup({
  items,
  groupTitle = 'Circuitos disponibles',
}: CircuitInfoAccordionGroupProps) {
  return (
    <section className={styles.sideCard}>
      <p className={styles.sideTitle}>{groupTitle}</p>
      <p className={styles.sideText}>Tocá cada circuito para desplegar la información completa, sus objetivos y condiciones de participación.</p>
      <div className={styles.accordionGroup}>
        {items.map((item, index) => (
          <div key={item.id} className={index > 0 ? styles.accordionDivider : undefined}>
            <CircuitInfoAccordionItem {...item} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function HistoricalCircuitAccordion() {
  return (
    <CircuitInfoAccordionGroup
      items={[
        {
          id: 'historico-cultural',
          title: 'Circuito Histórico Cultural',
          summary: 'Recorrido por espacios emblemáticos que conectan historia, cultura, industria e identidad tucumana.',
          iconName: 'landmark',
          paragraphs: [
            'El presente circuito histórico-cultural propone un recorrido por espacios emblemáticos de la ciudad de San Miguel de Tucumán que permiten comprender la identidad local a través de su historia, su cultura y su desarrollo productivo.',
            'A lo largo del itinerario, los visitantes podrán conocer distintos aspectos que conforman el patrimonio tucumano, desde su pasado industrial hasta sus expresiones artísticas y su legado histórico nacional.',
            'El recorrido incluye la visita al Museo de la Industria Azucarera, la Casa Natal de Mercedes Sosa, el Museo Casa de la Ciudad y la Casa Solar Belgraniana, articulando turismo, educación y patrimonio en una propuesta integral.',
            'Esta experiencia permite no solo recorrer espacios significativos, sino también reflexionar sobre la construcción de la identidad tucumana y la importancia de preservar ese legado para las futuras generaciones.',
          ],
        },
      ]}
    />
  )
}

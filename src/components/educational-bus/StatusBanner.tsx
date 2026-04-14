import styles from './form.module.css'

export function StatusBanner({
  tone,
  title,
  description,
}: {
  tone: 'success' | 'error'
  title: string
  description: string
}) {
  return (
    <div className={`${styles.statusBanner} ${tone === 'success' ? styles.statusSuccess : styles.statusError}`}>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

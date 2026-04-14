import styles from './form.module.css'

export function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button className={styles.submitButton} type="submit" disabled={loading}>
      {loading ? <span className={styles.spinner} aria-hidden /> : null}
      {loading ? 'Enviando solicitud...' : 'Enviar solicitud'}
    </button>
  )
}

import styles from './form.module.css'

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className={styles.errorText}>{message}</p>
}

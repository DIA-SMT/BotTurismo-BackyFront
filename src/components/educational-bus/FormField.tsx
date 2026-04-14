import type { ReactNode } from 'react'
import styles from './form.module.css'
import { FieldError } from './FieldError'

interface FormFieldProps {
  label: string
  required?: boolean
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}

export function FormField({ label, required, hint, error, className, children }: FormFieldProps) {
  return (
    <div className={`${styles.field} ${className || ''}`.trim()}>
      <label className={styles.fieldLabel}>
        {label} {required ? <span className={styles.required}>*</span> : null}
      </label>
      {children}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
      <FieldError message={error} />
    </div>
  )
}

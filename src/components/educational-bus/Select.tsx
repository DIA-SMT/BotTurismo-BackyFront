import type { SelectHTMLAttributes } from 'react'
import styles from './form.module.css'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean
}

export function Select({ hasError, className, children, ...props }: SelectProps) {
  return (
    <select {...props} className={`${styles.control} ${hasError ? styles.controlError : ''} ${className || ''}`.trim()}>
      {children}
    </select>
  )
}

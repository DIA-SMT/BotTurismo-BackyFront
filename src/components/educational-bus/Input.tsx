import type { InputHTMLAttributes } from 'react'
import styles from './form.module.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export function Input({ hasError, className, ...props }: InputProps) {
  return <input {...props} className={`${styles.control} ${hasError ? styles.controlError : ''} ${className || ''}`.trim()} />
}

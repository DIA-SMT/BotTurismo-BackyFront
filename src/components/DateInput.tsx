'use client'

import type { InputHTMLAttributes } from 'react'
import { useState } from 'react'

// <input type="date"> muestra la fecha según el idioma del NAVEGADOR, no de la
// página: un Chrome configurado en inglés la muestra MM/DD/AAAA aunque el
// sitio esté en español (reporte de turismo, 2026-09-11). Este wrapper
// superpone la fecha elegida SIEMPRE como DD/MM/AAAA; al enfocar el campo se
// ve el editor nativo para tipear, y el calendarcito sigue funcionando igual.
export function DateInput({ value, defaultValue, className, style, onFocus, onBlur, onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false)
  // Para inputs no controlados (defaultValue) el overlay sigue el valor tipeado.
  const [innerValue, setInnerValue] = useState(typeof defaultValue === 'string' ? defaultValue : '')

  const raw = typeof value === 'string' ? value : innerValue
  const display = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw.slice(8, 10)}/${raw.slice(5, 7)}/${raw.slice(0, 4)}` : ''
  const overlay = !focused

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <input
        type="date"
        {...(value !== undefined ? { value } : { defaultValue })}
        className={className}
        style={{ ...style, ...(overlay ? { color: 'transparent' } : {}) }}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        onChange={(event) => {
          setInnerValue(event.target.value)
          onChange?.(event)
        }}
        {...props}
      />
      {overlay ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 13,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            font: 'inherit',
            fontSize: display ? undefined : '0.85em',
            color: display ? 'inherit' : 'var(--text-secondary, #68737d)',
            whiteSpace: 'nowrap',
          }}
        >
          {display || 'dd/mm/aaaa'}
        </span>
      ) : null}
    </span>
  )
}

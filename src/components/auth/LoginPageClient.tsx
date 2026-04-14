'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './auth.module.css'

export default function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recoverMode, setRecoverMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión.')
      router.push(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  const handleRecover = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo enviar el correo de recuperación.')
      setMessage('Se envió un correo para restablecer la contraseña.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo de recuperación.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    if (recoverMode) {
      await handleRecover()
      return
    }

    await handleLogin()
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo%20SMT%20blanco%402x.png" alt="Ciudad SMT" className={styles.logo} />
        <h1 className={styles.title}>{recoverMode ? 'Recuperar contraseña' : 'Acceso al panel'}</h1>
        <p className={styles.text}>
          {recoverMode
            ? 'Ingresá tu email para recibir el enlace de restablecimiento.'
            : 'Ingresá tus credenciales para acceder al backoffice administrativo.'}
        </p>

        {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
        {message ? <div className={`${styles.message} ${styles.success}`}>{message}</div> : null}

        <form className={styles.stack} onSubmit={handleSubmit} noValidate>
          <div>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          {!recoverMode ? (
            <div>
              <label className={styles.label}>Contraseña</label>
              <input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          ) : null}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Procesando...' : recoverMode ? 'Enviar correo' : 'Iniciar sesión'}
          </button>

          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setRecoverMode((current) => !current)
              setError(null)
              setMessage(null)
            }}
          >
            {recoverMode ? 'Volver al inicio de sesión' : 'Olvidé mi contraseña'}
          </button>
        </form>
      </section>
    </main>
  )
}

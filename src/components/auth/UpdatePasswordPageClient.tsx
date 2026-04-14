'use client'

import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './auth.module.css'

function getRecoveryTokens() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  const type = params.get('type')
  if (!accessToken || !refreshToken || type !== 'recovery') return null
  return { accessToken, refreshToken }
}

export default function UpdatePasswordPageClient() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [recoveryTokens, setRecoveryTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null)

  useEffect(() => {
    setRecoveryTokens(getRecoveryTokens())
  }, [])

  const handlePasswordUpdate = async () => {
    setError(null)
    setMessage(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          accessToken: recoveryTokens?.accessToken,
          refreshToken: recoveryTokens?.refreshToken,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la contraseña.')
      setMessage('La contraseña se actualizó correctamente.')
      setTimeout(() => {
        router.push('/admin')
        router.refresh()
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    await handlePasswordUpdate()
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo%20SMT%20blanco%402x.png" alt="Ciudad SMT" className={styles.logo} />
        <h1 className={styles.title}>Actualizar contraseña</h1>
        <p className={styles.text}>
          {recoveryTokens
            ? 'Definí una nueva contraseña para recuperar el acceso.'
            : 'Por seguridad, debés cambiar la contraseña temporal antes de usar el panel.'}
        </p>

        {error ? <div className={`${styles.message} ${styles.error}`}>{error}</div> : null}
        {message ? <div className={`${styles.message} ${styles.success}`}>{message}</div> : null}

        <form className={styles.stack} onSubmit={handleSubmit} noValidate>
          <div>
            <label className={styles.label}>Nueva contraseña</label>
            <input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div>
            <label className={styles.label}>Confirmar contraseña</label>
            <input className={styles.input} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </section>
    </main>
  )
}

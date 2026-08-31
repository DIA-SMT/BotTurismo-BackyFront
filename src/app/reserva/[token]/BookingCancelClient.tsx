'use client'

import { useEffect, useState } from 'react'
import formStyles from '@/components/educational-bus/form.module.css'
import styles from '@/components/tourist-bus/tourist.module.css'
import { formatDepartureDate, formatDepartureTime, type TouristLanguage } from '@/lib/tourist-bus'

interface BookingSummary {
  fullName: string
  peopleCount: number
  municipalBikes: number
  status: 'confirmed' | 'cancelled'
  language: TouristLanguage
  departure: {
    title: string
    date: string
    time: string
    meetingPoint: string | null
    status: string
  }
  canCancel: boolean
}

const texts = {
  es: {
    title: 'Mi reserva',
    loading: 'Buscando tu reserva…',
    notFound: 'No encontramos esta reserva. Revisá el link del correo de confirmación.',
    people: 'Personas',
    bikes: 'Bicicletas municipales',
    meetingPoint: 'Punto de encuentro',
    statusConfirmed: 'Confirmada',
    statusCancelled: 'Cancelada',
    cancelButton: 'Cancelar mi reserva',
    cancelling: 'Cancelando…',
    confirmPrompt: '¿Seguro que querés cancelar tu reserva? El lugar se libera para otra persona.',
    cancelled: '✅ Tu reserva quedó cancelada y el lugar fue liberado. ¡Gracias por avisar!',
    cancelledWithEmail: '✅ Tu reserva quedó cancelada y te enviamos un correo de confirmación. ¡Gracias por avisar!',
    cannotCancel: 'Esta reserva ya no se puede cancelar: las bajas se aceptan hasta 24 horas antes de la salida.',
    backHome: '← Volver al Bus Turístico',
  },
  en: {
    title: 'My booking',
    loading: 'Looking up your booking…',
    notFound: 'We couldn’t find this booking. Check the link in your confirmation email.',
    people: 'People',
    bikes: 'Municipal bikes',
    meetingPoint: 'Meeting point',
    statusConfirmed: 'Confirmed',
    statusCancelled: 'Cancelled',
    cancelButton: 'Cancel my booking',
    cancelling: 'Cancelling…',
    confirmPrompt: 'Are you sure you want to cancel your booking? Your seat will be released.',
    cancelled: '✅ Your booking has been cancelled and your seat released. Thanks for letting us know!',
    cancelledWithEmail: '✅ Your booking has been cancelled and we sent you a confirmation email. Thanks for letting us know!',
    cannotCancel: 'This booking can no longer be cancelled: cancellations are accepted up to 24 hours before departure.',
    backHome: '← Back to the Tourist Bus',
  },
}

export function BookingCancelClient({ token }: { token: string }) {
  const [summary, setSummary] = useState<BookingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/tourist-bus/bookings/${token}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          setNotFound(true)
          return
        }
        const payload = await response.json()
        setSummary(payload.data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const t = texts[summary?.language === 'en' ? 'en' : 'es']
  const lang: TouristLanguage = summary?.language === 'en' ? 'en' : 'es'

  const handleCancel = async () => {
    if (!window.confirm(t.confirmPrompt)) return
    setCancelling(true)
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/tourist-bus/bookings/${token}`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || t.cannotCancel)
      setResultMessage(payload.data?.emailSent ? t.cancelledWithEmail : t.cancelled)
      setSummary((current) => (current ? { ...current, status: 'cancelled', canCancel: false } : current))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t.cannotCancel)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <main className={formStyles.page} style={{ minHeight: '100vh' }}>
      <div className={formStyles.shell} style={{ maxWidth: 620, paddingTop: 60, paddingBottom: 80 }}>
        <a href="/turistico" style={{ color: '#126ff5', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
          {t.backHome}
        </a>
        <h1 className={formStyles.sectionTitle} style={{ marginTop: 18, fontSize: '1.7rem' }}>
          {t.title}
        </h1>

        {loading ? (
          <p className={styles.emptyNotice} style={{ marginTop: 18 }}>{t.loading}</p>
        ) : notFound || !summary ? (
          <p className={styles.emptyNotice} style={{ marginTop: 18 }}>{texts.es.notFound}</p>
        ) : (
          <article className={styles.departureCard} style={{ marginTop: 18 }}>
            <span className={styles.departureDate}>
              {formatDepartureDate(summary.departure.date, lang)} · {formatDepartureTime(summary.departure.time)} h
            </span>
            <h2 className={styles.departureTitle}>{summary.departure.title}</h2>
            <div className={styles.departureMeta}>
              <span><strong>{summary.fullName}</strong></span>
              <span>{t.people}: {summary.peopleCount}</span>
              {summary.municipalBikes > 0 ? <span>🚲 {t.bikes}: {summary.municipalBikes}</span> : null}
              {summary.departure.meetingPoint ? (
                <span><strong>{t.meetingPoint}:</strong> {summary.departure.meetingPoint}</span>
              ) : null}
            </div>
            <div className={styles.departureFooter}>
              <span
                className={
                  summary.status === 'confirmed'
                    ? styles.seatsBadge
                    : `${styles.seatsBadge} ${styles.seatsBadgeNone}`
                }
              >
                {summary.status === 'confirmed' ? t.statusConfirmed : t.statusCancelled}
              </span>
              {summary.canCancel && !resultMessage ? (
                <button
                  type="button"
                  className={styles.departureButton}
                  style={{ background: '#b42323' }}
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? t.cancelling : t.cancelButton}
                </button>
              ) : null}
            </div>
            {resultMessage ? <p className={styles.emptyNotice}>{resultMessage}</p> : null}
            {errorMessage ? <p className={styles.emptyNotice} style={{ borderColor: '#b42323', color: '#b42323' }}>{errorMessage}</p> : null}
          </article>
        )}
      </div>
    </main>
  )
}

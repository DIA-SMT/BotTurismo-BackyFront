'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bus,
  Church,
  Footprints,
  Landmark,
  Lightbulb,
  MapPin,
  Moon,
  Sandwich,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import formStyles from '@/components/educational-bus/form.module.css'
import styles from './tourist.module.css'
import { TouristHeroMedia } from './TouristHeroMedia'
import { MouseExperience } from '@/components/MouseExperience'
import { FormField } from '@/components/educational-bus/FormField'
import { Input } from '@/components/educational-bus/Input'
import { Select } from '@/components/educational-bus/Select'
import { StatusBanner } from '@/components/educational-bus/StatusBanner'
import {
  formatDepartureDate,
  formatDepartureTime,
  initialTouristBookingFormData,
  maximumPeoplePerBooking,
  validateTouristBookingForm,
  type TouristBookingApiErrorCode,
  type TouristBookingFormData,
  type TouristBookingFormErrors,
  type TouristDepartureAvailability,
  type TouristLanguage,
} from '@/lib/tourist-bus'
import { getTouristCircuitBySlug, touristCircuitCatalog, touristOfficeInfo, type TouristCircuitIcon } from '@/lib/tourist-circuits'
import { touristPageCopy } from '@/lib/tourist-copy'

const languageStorageKey = 'tourist-bus-language'
const lowSeatsThreshold = 5

const circuitIcons: Record<TouristCircuitIcon, typeof Landmark> = {
  landmark: Landmark,
  bus: Bus,
  map: MapPin,
  footprints: Footprints,
  moon: Moon,
  sparkles: Sparkles,
  church: Church,
  lights: Lightbulb,
  sandwich: Sandwich,
  empanada: UtensilsCrossed,
}

type SubmitState =
  | { type: 'idle' }
  | { type: 'success'; title: string; dateLabel: string; emailSent: boolean }
  | { type: 'error'; code: TouristBookingApiErrorCode }

function getDepartureDisplayTitle(departure: TouristDepartureAvailability, language: TouristLanguage) {
  const circuit = getTouristCircuitBySlug(departure.circuit_slug)
  return circuit ? circuit.content[language].name : departure.title
}

// Agrupa salidas por circuito del catálogo; las personalizadas se agrupan por título.
function getDepartureCircuitKey(departure: TouristDepartureAvailability) {
  return departure.circuit_slug || `custom:${departure.title}`
}

export function TouristExperience() {
  const [language, setLanguage] = useState<TouristLanguage>('es')
  const [departures, setDepartures] = useState<TouristDepartureAvailability[]>([])
  const [departuresLoading, setDeparturesLoading] = useState(true)
  const [departuresFailed, setDeparturesFailed] = useState(false)
  const [formData, setFormData] = useState<TouristBookingFormData>(initialTouristBookingFormData)
  const [selectedCircuitKey, setSelectedCircuitKey] = useState('')
  const [circuitError, setCircuitError] = useState(false)
  const [errors, setErrors] = useState<TouristBookingFormErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>({ type: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [openCircuits, setOpenCircuits] = useState<Record<string, boolean>>({})

  const copy = touristPageCopy[language]

  useEffect(() => {
    const stored = window.localStorage.getItem(languageStorageKey)
    if (stored === 'en' || stored === 'es') {
      setLanguage(stored)
    }
  }, [])

  const changeLanguage = (nextLanguage: TouristLanguage) => {
    setLanguage(nextLanguage)
    window.localStorage.setItem(languageStorageKey, nextLanguage)
  }

  const loadDepartures = useCallback(async () => {
    setDeparturesLoading(true)
    setDeparturesFailed(false)
    try {
      const response = await fetch('/api/tourist-bus/departures', { cache: 'no-store' })
      if (!response.ok) throw new Error('departures_failed')
      const payload = (await response.json()) as { data?: TouristDepartureAvailability[] }
      setDepartures(payload.data || [])
    } catch {
      setDeparturesFailed(true)
    } finally {
      setDeparturesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDepartures()
  }, [loadDepartures])

  const bookableDepartures = useMemo(
    () => departures.filter((departure) => departure.remaining > 0),
    [departures],
  )

  const circuitGroups = useMemo(() => {
    const groups = new Map<string, string>()
    for (const departure of bookableDepartures) {
      const key = getDepartureCircuitKey(departure)
      if (!groups.has(key)) groups.set(key, getDepartureDisplayTitle(departure, language))
    }
    return Array.from(groups.entries()).map(([key, label]) => ({ key, label }))
  }, [bookableDepartures, language])

  const circuitDepartures = useMemo(
    () => bookableDepartures.filter((departure) => getDepartureCircuitKey(departure) === selectedCircuitKey),
    [bookableDepartures, selectedCircuitKey],
  )

  const selectedDeparture = useMemo(
    () => departures.find((departure) => String(departure.id) === formData.departureId) || null,
    [departures, formData.departureId],
  )

  // Si al refrescar los cupos el circuito o la salida elegida dejaron de estar
  // disponibles, se limpia la selección para no reservar sobre datos viejos.
  useEffect(() => {
    if (selectedCircuitKey && !circuitGroups.some((group) => group.key === selectedCircuitKey)) {
      setSelectedCircuitKey('')
      setFormData((current) => (current.departureId ? { ...current, departureId: '' } : current))
      return
    }
    if (formData.departureId && !circuitDepartures.some((departure) => String(departure.id) === formData.departureId)) {
      setFormData((current) => ({ ...current, departureId: '' }))
    }
  }, [circuitDepartures, circuitGroups, formData.departureId, selectedCircuitKey])

  const maxPeopleForSelection = selectedDeparture
    ? Math.min(maximumPeoplePerBooking, selectedDeparture.remaining)
    : maximumPeoplePerBooking

  const updateField = (field: keyof TouristBookingFormData) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { value } = event.target
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleCircuitChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextKey = event.target.value
    setSelectedCircuitKey(nextKey)
    setCircuitError(false)

    const departuresForCircuit = bookableDepartures.filter(
      (departure) => getDepartureCircuitKey(departure) === nextKey,
    )
    setFormData((current) => ({
      ...current,
      // Con una sola salida disponible para el circuito, se elige directamente.
      departureId: departuresForCircuit.length === 1 ? String(departuresForCircuit[0].id) : '',
    }))
    setErrors((current) => {
      if (!current.departureId) return current
      const next = { ...current }
      delete next.departureId
      return next
    })
  }

  const selectDeparture = (departureId: number) => {
    const departure = departures.find((item) => item.id === departureId)
    if (departure) setSelectedCircuitKey(getDepartureCircuitKey(departure))
    setCircuitError(false)
    setFormData((current) => ({ ...current, departureId: String(departureId) }))
    setErrors((current) => {
      if (!current.departureId) return current
      const next = { ...current }
      delete next.departureId
      return next
    })
    document.getElementById('reserva')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitState({ type: 'idle' })

    const validationErrors = validateTouristBookingForm(formData)
    if (!selectedCircuitKey) setCircuitError(true)
    if (Object.keys(validationErrors).length > 0 || !selectedCircuitKey) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/tourist-bus/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, language }),
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            code?: TouristBookingApiErrorCode
            fieldErrors?: TouristBookingFormErrors
            data?: { emailSent?: boolean }
          }
        | null

      if (!response.ok) {
        if (payload?.fieldErrors) {
          setErrors(payload.fieldErrors)
        }
        setSubmitState({ type: 'error', code: payload?.code || 'SERVER' })
        void loadDepartures()
        return
      }

      const bookedDeparture = selectedDeparture
      setSubmitState({
        type: 'success',
        title: bookedDeparture ? getDepartureDisplayTitle(bookedDeparture, language) : '',
        dateLabel: bookedDeparture
          ? `${formatDepartureDate(bookedDeparture.departure_date, language)} · ${formatDepartureTime(bookedDeparture.departure_time)} h`
          : '',
        emailSent: Boolean(payload?.data?.emailSent),
      })
      setFormData(initialTouristBookingFormData)
      setSelectedCircuitKey('')
      setCircuitError(false)
      setErrors({})
      void loadDepartures()
    } catch {
      setSubmitState({ type: 'error', code: 'SERVER' })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleCircuit = (slug: string) => {
    setOpenCircuits((current) => ({ ...current, [slug]: !current[slug] }))
  }

  const office = touristOfficeInfo[language]

  return (
    <main className={formStyles.page}>
      <MouseExperience />
      <header className={formStyles.header}>
        <a className={formStyles.brand} href="#inicio" aria-label={copy.backToHome}>
          <span className={formStyles.muniBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logoMuni-sm.png" alt="" className={formStyles.brandLogo} />
            <span className={formStyles.muniText}>
              <span>Ciudad</span>
              <strong>San Miguel</strong>
              <strong>de Tucumán</strong>
            </span>
          </span>
          <span className={formStyles.brandDivider} aria-hidden="true" />
          <span className={formStyles.productBrand}>
            <span className={formStyles.brandTitle}>{copy.brandTitle}</span>
          </span>
        </a>

        <nav className={formStyles.nav} aria-label="Navegación principal">
          <a href="#reserva">{copy.navBook}</a>
          <a href="#circuitos">{copy.navCircuits}</a>
          <a href="/galeria">{copy.navGallery}</a>
          <a href="/educativo">{copy.navEducational}</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className={styles.langToggle} role="group" aria-label="Idioma / Language">
            <button
              type="button"
              className={`${styles.langButton} ${language === 'es' ? styles.langButtonActive : ''}`.trim()}
              onClick={() => changeLanguage('es')}
            >
              ES
            </button>
            <button
              type="button"
              className={`${styles.langButton} ${language === 'en' ? styles.langButtonActive : ''}`.trim()}
              onClick={() => changeLanguage('en')}
            >
              EN
            </button>
          </div>
          <a className={formStyles.headerAction} href="#reserva">
            {copy.navBook}
          </a>
        </div>
      </header>

      <section id="inicio" className={formStyles.hero}>
        <TouristHeroMedia />
        <div className={styles.heroOverlayLight} />
        <div className={formStyles.heroContent}>
          <p className={formStyles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={formStyles.heroTitle}>{copy.heroTitle}</h1>
          <p className={formStyles.heroLead}>{copy.heroLead}</p>
          <div className={formStyles.heroActions}>
            <a className={formStyles.primaryCta} href="#reserva">
              {copy.heroPrimaryCta}
            </a>
            <a className={formStyles.secondaryCta} href="#circuitos">
              {copy.heroSecondaryCta}
            </a>
          </div>
        </div>
      </section>

      <div className={formStyles.assuranceBar}>
        <span>{copy.assuranceLeft}</span>
        <strong>{copy.assuranceRight}</strong>
      </div>

      <div className={formStyles.shell}>
        <section id="salidas" className={styles.departuresSection} aria-label={copy.departuresTitle}>
          <div className={styles.departuresHeader}>
            <h2 className={formStyles.sectionTitle}>{copy.departuresTitle}</h2>
            <p className={formStyles.sectionText}>{copy.departuresLead}</p>
          </div>

          {departuresLoading ? (
            <p className={styles.emptyNotice}>{copy.departuresLoading}</p>
          ) : departuresFailed ? (
            <p className={styles.emptyNotice}>{copy.departuresError}</p>
          ) : departures.length === 0 ? (
            <p className={styles.emptyNotice}>{copy.departuresEmpty}</p>
          ) : (
            <div className={styles.departuresGrid}>
              {departures.map((departure) => {
                const soldOut = departure.remaining <= 0
                const badgeClass = soldOut
                  ? `${styles.seatsBadge} ${styles.seatsBadgeNone}`
                  : departure.remaining <= lowSeatsThreshold
                    ? `${styles.seatsBadge} ${styles.seatsBadgeLow}`
                    : styles.seatsBadge

                return (
                  <article key={departure.id} className={styles.departureCard} data-mouse-tilt>
                    <span className={styles.departureDate}>
                      {formatDepartureDate(departure.departure_date, language)} · {formatDepartureTime(departure.departure_time)} h
                    </span>
                    <h3 className={styles.departureTitle}>{getDepartureDisplayTitle(departure, language)}</h3>
                    <div className={styles.departureMeta}>
                      {departure.meeting_point ? (
                        <span>
                          <strong>{copy.meetingPointLabel}:</strong> {departure.meeting_point}
                        </span>
                      ) : null}
                      {departure.notes ? <span>{departure.notes}</span> : null}
                    </div>
                    <div className={styles.departureFooter}>
                      <span className={badgeClass}>{soldOut ? copy.soldOut : copy.seatsLeft(departure.remaining)}</span>
                      <button
                        type="button"
                        className={styles.departureButton}
                        onClick={() => selectDeparture(departure.id)}
                        disabled={soldOut}
                      >
                        {copy.bookCta}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section id="reserva" className={formStyles.layoutSplit} style={{ marginTop: 46 }}>
          <section className={formStyles.formCard}>
            <div className={formStyles.sectionHeader}>
              <div>
                <h2 className={formStyles.sectionTitle}>{copy.formTitle}</h2>
                <p className={formStyles.sectionText}>{copy.formLead}</p>
              </div>
              <span className={formStyles.sectionBadge}>{copy.freeLabel}</span>
            </div>

            {submitState.type === 'success' ? (
              <StatusBanner
                tone="success"
                title={copy.successTitle}
                description={`${copy.successBody(submitState.title, submitState.dateLabel)}${submitState.emailSent ? ` ${copy.successEmailNote}` : ''}`}
              />
            ) : null}
            {submitState.type === 'error' ? (
              <StatusBanner tone="error" title={copy.apiErrors.VALIDATION} description={copy.apiErrors[submitState.code]} />
            ) : null}

            <form onSubmit={handleSubmit} noValidate>
              <div className={formStyles.grid}>
                <FormField
                  label={copy.circuitField}
                  required
                  error={circuitError ? copy.circuitRequired : undefined}
                  className={formStyles.gridFull}
                >
                  <Select value={selectedCircuitKey} onChange={handleCircuitChange} hasError={circuitError}>
                    <option value="">{copy.circuitPlaceholder}</option>
                    {circuitGroups.map((group) => (
                      <option key={group.key} value={group.key}>
                        {group.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  label={copy.departureField}
                  required
                  error={errors.departureId ? copy.fieldErrors[errors.departureId] : undefined}
                  className={formStyles.gridFull}
                >
                  <Select
                    value={formData.departureId}
                    onChange={updateField('departureId')}
                    disabled={!selectedCircuitKey}
                    hasError={Boolean(errors.departureId)}
                  >
                    <option value="">
                      {selectedCircuitKey ? copy.departurePlaceholder : copy.departureSelectCircuitFirst}
                    </option>
                    {circuitDepartures.map((departure) => (
                      <option key={departure.id} value={String(departure.id)}>
                        {formatDepartureDate(departure.departure_date, language)} · {formatDepartureTime(departure.departure_time)} h ({copy.seatsLeft(departure.remaining)})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  label={copy.fullNameField}
                  required
                  error={errors.fullName ? copy.fieldErrors[errors.fullName] : undefined}
                >
                  <Input
                    value={formData.fullName}
                    onChange={updateField('fullName')}
                    placeholder={copy.fullNamePlaceholder}
                    autoComplete="name"
                    hasError={Boolean(errors.fullName)}
                  />
                </FormField>

                <FormField
                  label={copy.peopleField}
                  required
                  error={errors.peopleCount ? copy.fieldErrors[errors.peopleCount] : undefined}
                >
                  <Input
                    type="number"
                    min={1}
                    max={maxPeopleForSelection}
                    value={formData.peopleCount}
                    onChange={updateField('peopleCount')}
                    hasError={Boolean(errors.peopleCount)}
                  />
                </FormField>

                <FormField
                  label={copy.emailField}
                  required
                  error={errors.email ? copy.fieldErrors[errors.email] : undefined}
                >
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={updateField('email')}
                    placeholder="nombre@email.com"
                    autoComplete="email"
                    hasError={Boolean(errors.email)}
                  />
                </FormField>

                <FormField
                  label={copy.phoneField}
                  required
                  error={errors.phone ? copy.fieldErrors[errors.phone] : undefined}
                >
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={updateField('phone')}
                    placeholder="+54 381 000 0000"
                    autoComplete="tel"
                    hasError={Boolean(errors.phone)}
                  />
                </FormField>

                <FormField label={copy.originField} className={formStyles.gridFull}>
                  <Input
                    value={formData.originCity}
                    onChange={updateField('originCity')}
                    placeholder={copy.originPlaceholder}
                    autoComplete="address-level2"
                  />
                </FormField>
              </div>

              <button className={formStyles.submitButton} type="submit" disabled={submitting}>
                {submitting ? <span className={formStyles.spinner} aria-hidden /> : null}
                {submitting ? copy.submittingLabel : copy.submitLabel}
              </button>
            </form>
          </section>

          <aside className={formStyles.sideStack}>
            <section className={formStyles.sideCard}>
              <p className={formStyles.sideTitle}>{office.title}</p>
              <p className={formStyles.sideText}>{office.address}</p>
              <ul className={styles.officeHours}>
                {office.hours.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className={formStyles.sideText} style={{ marginTop: 12 }}>
                {copy.officeNote}
              </p>
            </section>
          </aside>
        </section>

        <section id="circuitos" className={styles.catalogSection} aria-label={copy.circuitsTitle}>
          <div className={styles.departuresHeader}>
            <h2 className={formStyles.sectionTitle}>{copy.circuitsTitle}</h2>
            <p className={formStyles.sectionText}>{copy.circuitsLead}</p>
          </div>

          <div className={styles.catalogGrid}>
            {touristCircuitCatalog.map((circuit) => {
              const content = circuit.content[language]
              const Icon = circuitIcons[circuit.iconName]
              const isOpen = Boolean(openCircuits[circuit.slug])

              return (
                <article key={circuit.slug} className={styles.catalogCard} data-mouse-tilt>
                  <span className={styles.catalogIcon}>
                    <Icon size={22} strokeWidth={1.9} />
                  </span>
                  <h3 className={styles.catalogName}>{content.name}</h3>
                  <p className={styles.catalogSummary}>{content.summary}</p>
                  <div className={styles.catalogMeta}>
                    <span>
                      <strong>{copy.scheduleLabel}:</strong> {content.schedule}
                    </span>
                    {content.duration ? (
                      <span>
                        <strong>{copy.durationLabel}:</strong> {content.duration}
                      </span>
                    ) : null}
                  </div>
                  {isOpen ? (
                    <div className={styles.catalogDetails}>
                      <p>{content.description}</p>
                      <div>
                        <strong>{copy.highlightsLabel}</strong>
                        <ul className={styles.highlightsList}>
                          {content.highlights.map((highlight) => (
                            <li key={highlight}>{highlight}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                  <button type="button" className={styles.catalogToggle} onClick={() => toggleCircuit(circuit.slug)}>
                    {isOpen ? copy.detailsHide : copy.detailsShow}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}

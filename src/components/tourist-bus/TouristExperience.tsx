'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bike,
  Bus,
  Camera,
  ChevronLeft,
  ChevronRight,
  Church,
  Footprints,
  Landmark,
  Lightbulb,
  MapPin,
  Moon,
  Music,
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
  formatDepartureDateShort,
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
import {
  touristCircuitCatalog,
  touristOfficeInfo,
  type TouristCircuit,
  type TouristCircuitIcon,
} from '@/lib/tourist-circuits'
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
  bike: Bike,
  music: Music,
}

interface PublicPhotoBook {
  id: string
  title: string
  tour_date: string
  description: string | null
  access_token: string
  photo_count: number
}

type SubmitState =
  | { type: 'idle' }
  | { type: 'success'; title: string; dateLabel: string; emailSent: boolean }
  | { type: 'error'; code: TouristBookingApiErrorCode }

// Agrupa salidas por circuito del catálogo; las personalizadas se agrupan por título.
function getDepartureCircuitKey(departure: TouristDepartureAvailability) {
  return departure.circuit_slug || `custom:${departure.title}`
}

export function TouristExperience() {
  const [language, setLanguage] = useState<TouristLanguage>('es')
  const [departures, setDepartures] = useState<TouristDepartureAvailability[]>([])
  const [departuresLoading, setDeparturesLoading] = useState(true)
  const [departuresFailed, setDeparturesFailed] = useState(false)
  // Catálogo administrable: se lee de la base; si falla, queda el estático.
  const [circuits, setCircuits] = useState<TouristCircuit[]>(touristCircuitCatalog)
  // Galerías de fotos públicas vigentes (books por día). Si no hay, la sección se oculta.
  const [photoBooks, setPhotoBooks] = useState<PublicPhotoBook[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/photo-books', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return
        const payload = (await response.json()) as { data?: PublicPhotoBook[] }
        if (!cancelled && payload.data) setPhotoBooks(payload.data.slice(0, 6))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const [formData, setFormData] = useState<TouristBookingFormData>(initialTouristBookingFormData)
  const [selectedCircuitKey, setSelectedCircuitKey] = useState('')
  const [circuitError, setCircuitError] = useState(false)
  // Bicis: '' sin elegir, 'own' llevan propias, 'municipal' necesitan prestadas
  const [bikeChoice, setBikeChoice] = useState<'' | 'own' | 'municipal'>('')
  const [bikeChoiceError, setBikeChoiceError] = useState(false)
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

  useEffect(() => {
    let cancelled = false
    fetch('/api/tourist-bus/circuits', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return
        const payload = (await response.json()) as { data?: TouristCircuit[] }
        if (!cancelled && payload.data && payload.data.length > 0) {
          setCircuits(payload.data)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const circuitsBySlug = useMemo(() => {
    const map = new Map<string, TouristCircuit>()
    for (const circuit of circuits) map.set(circuit.slug, circuit)
    return map
  }, [circuits])

  const getDepartureDisplayTitle = useCallback(
    (departure: TouristDepartureAvailability, lang: TouristLanguage) => {
      const circuit = departure.circuit_slug ? circuitsBySlug.get(departure.circuit_slug) : null
      return circuit ? circuit.content[lang].name : departure.title
    },
    [circuitsBySlug],
  )

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
  }, [bookableDepartures, getDepartureDisplayTitle, language])

  const circuitDepartures = useMemo(
    () => bookableDepartures.filter((departure) => getDepartureCircuitKey(departure) === selectedCircuitKey),
    [bookableDepartures, selectedCircuitKey],
  )

  const selectedDeparture = useMemo(
    () => departures.find((departure) => String(departure.id) === formData.departureId) || null,
    [departures, formData.departureId],
  )

  // Una tarjeta por circuito: su salida más próxima con cupo (o la próxima a
  // secas si está todo vendido) + chips con las siguientes fechas.
  const circuitCards = useMemo(() => {
    const groups = new Map<string, TouristDepartureAvailability[]>()
    for (const departure of departures) {
      const key = getDepartureCircuitKey(departure)
      const list = groups.get(key) || []
      list.push(departure)
      groups.set(key, list)
    }

    return Array.from(groups.values())
      .map((list) => {
        const featured = list.find((departure) => departure.remaining > 0) || list[0]
        const otherBookable = list.filter((departure) => departure.id !== featured.id && departure.remaining > 0)
        return {
          featured,
          chips: otherBookable.slice(0, 3),
          extraCount: Math.max(0, otherBookable.length - 3),
        }
      })
      .sort((a, b) =>
        `${a.featured.departure_date}${a.featured.departure_time}`.localeCompare(
          `${b.featured.departure_date}${b.featured.departure_time}`,
        ),
      )
  }, [departures])

  const carouselTrackRef = useRef<HTMLDivElement | null>(null)
  const [carouselOverflows, setCarouselOverflows] = useState(false)

  useEffect(() => {
    const track = carouselTrackRef.current
    if (!track) return
    const update = () => setCarouselOverflows(track.scrollWidth > track.clientWidth + 8)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(track)
    return () => observer.disconnect()
  }, [circuitCards.length, departuresLoading])

  const scrollCarousel = (direction: 1 | -1) => {
    carouselTrackRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  }

  // Si la salida elegida no presta bicicletas, el selector y el campo vuelven
  // a cero (evita mandar bicis de una selección anterior).
  useEffect(() => {
    if (!selectedDeparture || selectedDeparture.bike_stock === null) {
      setBikeChoice('')
      setBikeChoiceError(false)
      setFormData((current) => (current.municipalBikes === '0' ? current : { ...current, municipalBikes: '0' }))
    }
  }, [selectedDeparture])

  const handleBikeChoice = (value: '' | 'own' | 'municipal') => {
    setBikeChoice(value)
    setBikeChoiceError(false)
    setFormData((current) => ({
      ...current,
      // Con bicis propias no piden municipales; al pedir municipales se
      // precarga la cantidad de personas (el caso más común).
      municipalBikes: value === 'municipal' ? current.peopleCount || '1' : '0',
    }))
    setErrors((current) => {
      if (!current.municipalBikes) return current
      const next = { ...current }
      delete next.municipalBikes
      return next
    })
  }

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

    const bikesEnabled = selectedDeparture?.bike_stock != null
    const validationErrors = validateTouristBookingForm(formData, { bikesEnabled })
    if (!selectedCircuitKey) setCircuitError(true)
    const missingBikeChoice = bikesEnabled && bikeChoice === ''
    if (missingBikeChoice) setBikeChoiceError(true)
    if (bikesEnabled && bikeChoice === 'municipal' && Number(formData.municipalBikes) < 1) {
      validationErrors.municipalBikes = 'bikes_invalid'
    }
    if (Object.keys(validationErrors).length > 0 || !selectedCircuitKey || missingBikeChoice) {
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
      setBikeChoice('')
      setBikeChoiceError(false)
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
          <a href="/login">{copy.navLogin}</a>
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
          ) : circuitCards.length === 0 ? (
            <p className={styles.emptyNotice}>{copy.departuresEmpty}</p>
          ) : (
            <div className={styles.carouselWrap}>
              {carouselOverflows ? (
                <button
                  type="button"
                  className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
                  onClick={() => scrollCarousel(-1)}
                  aria-label={copy.carouselPrev}
                >
                  <ChevronLeft size={20} />
                </button>
              ) : null}

              <div className={styles.carouselTrack} ref={carouselTrackRef}>
                {circuitCards.map(({ featured, chips, extraCount }) => {
                  const soldOut = featured.remaining <= 0
                  const badgeClass = soldOut
                    ? `${styles.seatsBadge} ${styles.seatsBadgeNone}`
                    : featured.remaining <= lowSeatsThreshold
                      ? `${styles.seatsBadge} ${styles.seatsBadgeLow}`
                      : styles.seatsBadge

                  return (
                    <article key={featured.id} className={styles.departureCard} data-mouse-tilt>
                      <span className={styles.departureDate}>
                        {formatDepartureDate(featured.departure_date, language)} · {formatDepartureTime(featured.departure_time)} h
                      </span>
                      <h3 className={styles.departureTitle}>{getDepartureDisplayTitle(featured, language)}</h3>
                      <div className={styles.departureMeta}>
                        {featured.meeting_point ? (
                          <span>
                            <strong>{copy.meetingPointLabel}:</strong> {featured.meeting_point}
                          </span>
                        ) : null}
                        {featured.notes ? <span>{featured.notes}</span> : null}
                        {featured.bike_stock !== null ? (
                          <span className={styles.bikesLine}>
                            {(featured.bikes_remaining ?? 0) > 0
                              ? `${copy.bikesLeft(featured.bikes_remaining ?? 0)} · ${copy.bikesBring}`
                              : copy.bikesSoldOut}
                          </span>
                        ) : null}
                      </div>
                      {chips.length > 0 || extraCount > 0 ? (
                        <div className={styles.chipsRow}>
                          <span className={styles.chipsLabel}>{copy.moreDatesLabel}:</span>
                          {chips.map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              className={styles.dateChip}
                              onClick={() => selectDeparture(chip.id)}
                              title={`${formatDepartureDate(chip.departure_date, language)} · ${formatDepartureTime(chip.departure_time)} h`}
                            >
                              {formatDepartureDateShort(chip.departure_date, language)}
                            </button>
                          ))}
                          {extraCount > 0 ? <span className={styles.chipMore}>{copy.moreDatesExtra(extraCount)}</span> : null}
                        </div>
                      ) : null}
                      <div className={styles.departureFooter}>
                        <span className={badgeClass}>{soldOut ? copy.soldOut : copy.seatsLeft(featured.remaining)}</span>
                        <button
                          type="button"
                          className={styles.departureButton}
                          onClick={() => selectDeparture(featured.id)}
                          disabled={soldOut}
                        >
                          {copy.bookCta}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>

              {carouselOverflows ? (
                <button
                  type="button"
                  className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
                  onClick={() => scrollCarousel(1)}
                  aria-label={copy.carouselNext}
                >
                  <ChevronRight size={20} />
                </button>
              ) : null}
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
                  hint={copy.departureHint}
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
                  hint={copy.peopleHint}
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

                {selectedDeparture && selectedDeparture.bike_stock !== null ? (
                  <FormField
                    label={copy.bikesChoiceField}
                    required
                    error={bikeChoiceError ? copy.bikesChoiceError : undefined}
                    className={formStyles.gridFull}
                  >
                    <Select
                      value={bikeChoice}
                      onChange={(event) => handleBikeChoice(event.target.value as '' | 'own' | 'municipal')}
                      hasError={bikeChoiceError}
                    >
                      <option value="">{copy.bikesChoicePlaceholder}</option>
                      <option value="own">{copy.bikesChoiceOwn}</option>
                      <option value="municipal">{copy.bikesChoiceMunicipal}</option>
                    </Select>
                  </FormField>
                ) : null}

                {selectedDeparture && selectedDeparture.bike_stock !== null && bikeChoice === 'municipal' ? (
                  <FormField
                    label={copy.bikesField}
                    required
                    hint={copy.bikesHint(selectedDeparture.bikes_remaining ?? 0)}
                    error={errors.municipalBikes ? copy.fieldErrors[errors.municipalBikes] : undefined}
                    className={formStyles.gridFull}
                  >
                    <Input
                      type="number"
                      min={1}
                      max={Math.min(
                        selectedDeparture.bikes_remaining ?? 0,
                        Number(formData.peopleCount) || maximumPeoplePerBooking,
                      )}
                      value={formData.municipalBikes}
                      onChange={updateField('municipalBikes')}
                      hasError={Boolean(errors.municipalBikes)}
                    />
                  </FormField>
                ) : null}

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
            {circuits.map((circuit) => {
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
                    {content.schedule ? (
                      <span>
                        <strong>{copy.scheduleLabel}:</strong> {content.schedule}
                      </span>
                    ) : null}
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

        {photoBooks.length > 0 ? (
          <section id="fotos" className={styles.catalogSection} aria-label={copy.galleryTitle}>
            <div className={styles.departuresHeader}>
              <h2 className={formStyles.sectionTitle}>{copy.galleryTitle}</h2>
              <p className={formStyles.sectionText}>{copy.galleryLead}</p>
            </div>

            <div className={styles.galleryGrid}>
              {photoBooks.map((book) => (
                <a key={book.id} href={`/fotos/${book.access_token}`} className={styles.galleryCard} data-mouse-tilt>
                  <span className={styles.galleryIcon}>
                    <Camera size={20} strokeWidth={1.9} />
                  </span>
                  <span className={styles.galleryDate}>{formatDepartureDate(book.tour_date, language)}</span>
                  <span className={styles.galleryName}>{book.title}</span>
                  <span className={styles.galleryMeta}>
                    {copy.galleryCount(book.photo_count)} · {copy.galleryOpen}
                  </span>
                </a>
              ))}
            </div>

            <a href="/galeria" className={styles.galleryAllLink}>
              {copy.galleryAll} →
            </a>
          </section>
        ) : null}
      </div>
    </main>
  )
}

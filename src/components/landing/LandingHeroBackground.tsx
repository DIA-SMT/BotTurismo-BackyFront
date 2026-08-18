'use client'

import { useEffect, useState } from 'react'
import styles from '@/app/landing.module.css'
import { touristHeroImages as touristImages } from '@/lib/tourist-circuits'

export type LandingHeroVariant = 'split' | 'mixed'

const slideIntervalMs = 7000

function useMotionAllowed() {
  const [motionAllowed, setMotionAllowed] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setMotionAllowed(!mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return motionAllowed
}

function useSlideIndex(slideCount: number, active: boolean) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active || slideCount < 2) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount)
    }, slideIntervalMs)
    return () => window.clearInterval(timer)
  }, [active, slideCount])

  return index
}

function BusVideo({ motionAllowed }: { motionAllowed: boolean }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bus2.jpg" alt="" className={styles.bgMedia} />
      {motionAllowed ? (
        <video
          className={styles.bgMedia}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/bus2.jpg"
          tabIndex={-1}
        >
          <source src="/videos/bus-turistico-smt.mp4" type="video/mp4" />
        </video>
      ) : null}
    </>
  )
}

// Fondo del landing en dos variantes:
// - split: mitad izquierda slideshow turístico, mitad derecha video del bus
//   (en pantallas chicas queda solo el slideshow a pantalla completa)
// - mixed: un solo plano que rota video -> plaza -> El Cadillal
export function LandingHeroBackground({ variant }: { variant: LandingHeroVariant }) {
  const motionAllowed = useMotionAllowed()
  const touristIndex = useSlideIndex(touristImages.length, motionAllowed)
  const mixedIndex = useSlideIndex(touristImages.length + 1, motionAllowed && variant === 'mixed')

  if (variant === 'mixed') {
    return (
      <div className={styles.bgLayer} aria-hidden="true">
        <div className={`${styles.bgSlide} ${mixedIndex === 0 ? styles.bgSlideActive : ''}`.trim()}>
          <BusVideo motionAllowed={motionAllowed} />
        </div>
        {touristImages.map((src, index) => (
          <div
            key={src}
            className={`${styles.bgSlide} ${mixedIndex === index + 1 ? styles.bgSlideActive : ''}`.trim()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={styles.bgMedia} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`${styles.bgLayer} ${styles.bgSplit}`} aria-hidden="true">
      <div className={`${styles.bgHalf} ${styles.bgTourist}`}>
        {touristImages.map((src, index) => (
          <div
            key={src}
            className={`${styles.bgSlide} ${touristIndex === index ? styles.bgSlideActive : ''}`.trim()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className={styles.bgMedia} />
          </div>
        ))}
        <div className={styles.bgHalfVeil} />
      </div>
      <div className={`${styles.bgHalf} ${styles.bgEducational}`}>
        <BusVideo motionAllowed={motionAllowed} />
        <div className={styles.bgHalfVeil} />
      </div>
    </div>
  )
}

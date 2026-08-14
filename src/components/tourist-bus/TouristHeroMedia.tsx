'use client'

import { useEffect, useState } from 'react'
import formStyles from '@/components/educational-bus/form.module.css'
import styles from './tourist.module.css'
import { touristHeroImages as heroImages } from '@/lib/tourist-circuits'

const slideIntervalMs = 7000

export function TouristHeroMedia() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [motionAllowed, setMotionAllowed] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setMotionAllowed(!mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (!motionAllowed || heroImages.length < 2) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroImages.length)
    }, slideIntervalMs)
    return () => window.clearInterval(timer)
  }, [motionAllowed])

  return (
    <div className={formStyles.heroMedia} aria-hidden="true">
      {heroImages.map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className={`${styles.heroSlide} ${index === activeIndex ? styles.heroSlideActive : ''}`.trim()}
        />
      ))}
    </div>
  )
}

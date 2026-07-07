'use client'

import { useEffect, useState } from 'react'
import styles from './form.module.css'

export function HeroMedia() {
  const [motionAllowed, setMotionAllowed] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setMotionAllowed(!mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return (
    <div className={styles.heroMedia} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bus2.jpg" alt="" className={styles.heroPoster} />
      {motionAllowed ? (
        <video
          className={styles.heroVideo}
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
    </div>
  )
}

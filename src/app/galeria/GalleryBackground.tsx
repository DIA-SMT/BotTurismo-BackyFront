'use client'

import { useEffect, useState } from 'react'
import styles from './gallery-index.module.css'

export default function GalleryBackground({ images }: { images: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (images.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length)
    }, 6500)

    return () => window.clearInterval(timer)
  }, [images.length])

  return (
    <div className={styles.backgroundSlides} aria-hidden="true">
      {images.map((image, index) => (
        <div
          className={`${styles.backgroundSlide} ${index === activeIndex ? styles.backgroundSlideActive : ''}`}
          key={`${image}-${index}`}
          style={{ backgroundImage: `url("${image}")` }}
        />
      ))}
      <div className={styles.backgroundShade} />
    </div>
  )
}


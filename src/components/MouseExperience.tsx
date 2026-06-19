'use client'

import { useEffect } from 'react'

export function MouseExperience() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (reducedMotion || !finePointer) return

    let frame = 0
    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2

    const render = () => {
      frame = 0

      const xRatio = mouseX / window.innerWidth - 0.5
      const yRatio = mouseY / window.innerHeight - 0.5
      document.documentElement.style.setProperty('--mouse-parallax-x', `${xRatio * -18}px`)
      document.documentElement.style.setProperty('--mouse-parallax-y', `${yRatio * -12}px`)
    }

    const onPointerMove = (event: PointerEvent) => {
      mouseX = event.clientX
      mouseY = event.clientY
      if (!frame) frame = window.requestAnimationFrame(render)
    }

    const tiltElements = Array.from(document.querySelectorAll<HTMLElement>('[data-mouse-tilt]'))
    const cleanups = tiltElements.map((element) => {
      const onTilt = (event: PointerEvent) => {
        const bounds = element.getBoundingClientRect()
        const x = (event.clientX - bounds.left) / bounds.width - 0.5
        const y = (event.clientY - bounds.top) / bounds.height - 0.5
        element.style.setProperty('--tilt-x', `${y * -5}deg`)
        element.style.setProperty('--tilt-y', `${x * 7}deg`)
        element.style.setProperty('--shine-x', `${(x + 0.5) * 100}%`)
        element.style.setProperty('--shine-y', `${(y + 0.5) * 100}%`)
      }
      const resetTilt = () => {
        element.style.setProperty('--tilt-x', '0deg')
        element.style.setProperty('--tilt-y', '0deg')
      }

      element.addEventListener('pointermove', onTilt)
      element.addEventListener('pointerleave', resetTilt)
      return () => {
        element.removeEventListener('pointermove', onTilt)
        element.removeEventListener('pointerleave', resetTilt)
      }
    })

    window.addEventListener('pointermove', onPointerMove, { passive: true })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      cleanups.forEach((cleanup) => cleanup())
      document.documentElement.style.removeProperty('--mouse-parallax-x')
      document.documentElement.style.removeProperty('--mouse-parallax-y')
    }
  }, [])

  return null
}

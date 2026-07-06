import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/*
 * useInView(options)
 *
 * Returns [ref, inView] — flips true when the element enters the viewport.
 * Respects prefers-reduced-motion by marking visible immediately.
 */
export function useInView({ threshold = 0.12, rootMargin = '0px 0px -8% 0px', once = true } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(() => prefersReducedMotion())

  useEffect(() => {
    if (prefersReducedMotion()) {
      setInView(true)
      return
    }

    const node = ref.current

    if (!node) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)

          if (once) {
            observer.disconnect()
          }
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return [ref, inView]
}

import { useEffect, useRef, useState } from 'react'

/*
 * useAnimatedNumber(target, options)
 *
 * Eases from the previous value to target over `duration` ms.
 * Used for dashboard balance count-up on load and range changes.
 */
export function useAnimatedNumber(target, { duration = 900 } = {}) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const to = Number(target)

    if (!Number.isFinite(to)) {
      setValue(0)
      fromRef.current = 0
      return
    }

    const from = fromRef.current
    if (from === to) {
      return
    }

    const start = performance.now()
    let rafId

    function step(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      const next = from + (to - from) * eased

      setValue(next)

      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        fromRef.current = to
      }
    }

    rafId = requestAnimationFrame(step)

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [target, duration])

  return value
}

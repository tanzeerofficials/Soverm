import { useEffect, useState } from 'react'

export function useTypewriter(text, enabled, { speed = 22 } = {}) {
  const [display, setDisplay] = useState(enabled ? text : '')

  useEffect(() => {
    if (!enabled) {
      setDisplay('')
      return
    }

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(text)
      return
    }

    setDisplay('')
    let index = 0

    const intervalId = setInterval(() => {
      index += 1
      setDisplay(text.slice(0, index))

      if (index >= text.length) {
        clearInterval(intervalId)
      }
    }, speed)

    return () => clearInterval(intervalId)
  }, [text, enabled, speed])

  return display
}

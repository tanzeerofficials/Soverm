/*
 * CONFETTI BURST
 *
 * Lightweight CSS-only celebration particles — no canvas library needed.
 * Renders once, auto-clears after the animation finishes.
 */

import { useEffect, useMemo } from 'react'

const CONFETTI_COLORS = ['#10b981', '#8b5cf6', '#34d399', '#c4b5fd', '#f59e0b']

function ConfettiBurst({ active, durationMs = 2600, onComplete }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => ({
        id: index,
        left: `${4 + Math.random() * 92}%`,
        delay: `${Math.random() * 0.35}s`,
        duration: `${1.1 + Math.random() * 0.9}s`,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        rotation: Math.random() * 360,
        size: 5 + Math.random() * 7,
        drift: `${-30 + Math.random() * 60}px`,
      })),
    []
  )

  useEffect(() => {
    if (!active) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onComplete?.()
    }, durationMs)

    return () => window.clearTimeout(timeoutId)
  }, [active, durationMs, onComplete])

  if (!active) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="confetti-particle"
          style={{
            left: particle.left,
            width: `${particle.size}px`,
            height: `${Math.max(4, particle.size * 0.55)}px`,
            backgroundColor: particle.color,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
            transform: `rotate(${particle.rotation}deg)`,
            ['--confetti-drift']: particle.drift,
          }}
        />
      ))}
    </div>
  )
}

export default ConfettiBurst

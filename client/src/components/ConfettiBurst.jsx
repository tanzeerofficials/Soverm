/*
 * CONFETTI BURST
 *
 * Lightweight CSS-only celebration particles — no canvas library needed.
 * Renders once, auto-clears after the animation finishes.
 *
 * Particle layout is deterministic (index-based) so render stays pure —
 * Math.random during render trips React’s purity lint rule.
 */

import { useEffect, useMemo } from 'react'

const CONFETTI_DARK = ['#10b981', '#8b5cf6', '#34d399', '#c4b5fd', '#f59e0b']
const CONFETTI_LIGHT = ['#059669', '#7c3aed', '#10b981', '#8b5cf6', '#d97706']

function getConfettiColors() {
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light') {
    return CONFETTI_LIGHT
  }
  return CONFETTI_DARK
}

function buildParticles(palette) {
  return Array.from({ length: 36 }, (_, index) => ({
    id: index,
    left: `${4 + ((index * 17) % 92)}%`,
    delay: `${((index * 0.047) % 0.35).toFixed(3)}s`,
    duration: `${(1.1 + ((index * 0.073) % 0.9)).toFixed(3)}s`,
    color: palette[index % palette.length],
    rotation: (index * 47) % 360,
    size: 5 + ((index * 3) % 7),
    drift: `${-30 + ((index * 11) % 60)}px`,
  }))
}

function ConfettiBurst({ active, durationMs = 2600, onComplete }) {
  const particles = useMemo(() => {
    if (!active) {
      return []
    }
    return buildParticles(getConfettiColors())
  }, [active])

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

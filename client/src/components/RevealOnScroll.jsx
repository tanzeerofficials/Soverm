import { useInView } from '../hooks/useInView.js'

/*
 * Soft fade-in when a section enters view.
 * Starts at opacity-40 (still readable while scrolling fast) and finishes in ~350ms.
 * prefers-reduced-motion users skip the animation via useInView.
 */
function RevealOnScroll({ children, className = '', delay = 0 }) {
  const [ref, inView] = useInView({ rootMargin: '0px 0px -4% 0px', threshold: 0.08 })

  return (
    <div
      ref={ref}
      className={`transition-all duration-[350ms] ease-out will-change-transform ${
        inView ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-40'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default RevealOnScroll

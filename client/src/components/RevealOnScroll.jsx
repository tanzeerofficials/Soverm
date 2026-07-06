import { useInView } from '../hooks/useInView.js'

function RevealOnScroll({ children, className = '', delay = 0 }) {
  const [ref, inView] = useInView()

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out will-change-transform ${
        inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default RevealOnScroll

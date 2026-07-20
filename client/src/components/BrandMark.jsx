import { Link } from 'react-router-dom'

function BrandMark({ to = '/dashboard', compact = false, className = '' }) {
  return (
    <Link to={to} className={`group flex min-w-0 items-center gap-2.5 ${className}`}>
      <div className="logo-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10 transition group-hover:brightness-110">
        <span className="logo-chip-letter text-sm font-bold tracking-tight">S</span>
      </div>
      {!compact && (
        <p className="truncate text-sm font-semibold tracking-[0.22em] text-fg">SOVERM</p>
      )}
    </Link>
  )
}

export default BrandMark

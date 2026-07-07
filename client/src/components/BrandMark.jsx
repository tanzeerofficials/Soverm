import { Link } from 'react-router-dom'

function BrandMark({ to = '/dashboard', compact = false, className = '' }) {
  return (
    <Link to={to} className={`group flex min-w-0 items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 ring-1 ring-white/10 transition group-hover:shadow-emerald-500/40">
        <span className="text-sm font-bold tracking-tight text-emerald-950">S</span>
      </div>
      {!compact && (
        <p className="truncate text-sm font-semibold tracking-[0.22em] text-fg">SOVERM</p>
      )}
    </Link>
  )
}

export default BrandMark

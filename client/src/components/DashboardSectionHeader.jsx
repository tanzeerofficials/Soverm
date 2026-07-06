function DashboardSectionHeader({ title, accent = null, className = '' }) {
  return (
    <div className={`mb-4 flex items-center gap-2 ${className}`}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-fg-muted">
        {title}
      </h2>
      {accent === 'ai' && (
        <span className="h-2 w-2 rounded-full bg-ai" aria-hidden="true" />
      )}
      {accent === 'brand' && (
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
      )}
    </div>
  )
}

export default DashboardSectionHeader

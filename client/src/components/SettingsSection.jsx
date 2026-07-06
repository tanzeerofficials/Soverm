function SettingsSection({ title, children, variant = 'default', className = '' }) {
  const isDanger = variant === 'danger'

  return (
    <section
      className={`rounded-xl border bg-surface p-5 sm:p-6 ${
        isDanger ? 'border-danger/30' : 'border-border-default'
      } ${className}`}
    >
      <h2
        className={`text-xs font-semibold uppercase tracking-[0.25em] ${
          isDanger ? 'text-danger' : 'text-fg-muted'
        }`}
      >
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default SettingsSection

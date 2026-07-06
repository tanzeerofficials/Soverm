function PageHeader({ title, description, children, className = '' }) {
  return (
    <div className={`mb-8 ${className}`}>
      <h1 className="text-2xl font-bold text-fg">{title}</h1>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{description}</p>
      )}
      {children}
    </div>
  )
}

export default PageHeader

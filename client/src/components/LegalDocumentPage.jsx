/*
 * Shared layout for Privacy Policy and Terms of Service.
 */

import { Link } from 'react-router-dom'

function LegalDocumentPage({ title, effectiveDate = 'July 9, 2026', children }) {
  return (
    <div className="min-h-screen bg-app text-fg">
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand">Legal</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-fg-muted">Effective date: {effectiveDate}</p>
        <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-fg-muted">
          {children}
        </div>
        <Link
          to="/"
          className="mt-12 inline-block text-sm text-fg-muted transition hover:text-fg"
        >
          ← Back to home
        </Link>
      </main>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export { LegalDocumentPage, Section }

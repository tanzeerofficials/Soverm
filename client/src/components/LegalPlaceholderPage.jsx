/*
 * LEGAL PLACEHOLDER
 *
 * Shared shell for /privacy and /terms until real legal copy is provided
 * (contact email, jurisdiction, business entity name).
 */

import { Link } from 'react-router-dom'

function LegalPlaceholderPage({ title }) {
  return (
    <div className="min-h-screen bg-app text-fg">
      <main className="mx-auto max-w-2xl px-6 py-24 text-center sm:py-32">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand">
          Legal
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-6 text-sm leading-relaxed text-fg-muted">Coming soon.</p>
        <p className="mt-2 text-xs text-fg-subtle">
          Full legal copy will be published once finalized.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block text-sm text-fg-muted transition hover:text-fg"
        >
          ← Back to home
        </Link>
      </main>
    </div>
  )
}

export default LegalPlaceholderPage

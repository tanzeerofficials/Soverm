/*
 * NOT FOUND PAGE (404)
 *
 * If someone visits a URL that does not exist,
 * this friendly page explains what happened and links back home.
 */

import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-app px-6 text-fg">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand">
          404
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg">
          Page not found
        </h1>
        <p className="mt-3 text-fg-muted">
          The page you are looking for does not exist.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-lg bg-brand px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-brand-soft"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}

export default NotFoundPage

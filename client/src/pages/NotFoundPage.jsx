/*
 * NOT FOUND PAGE (404)
 *
 * If someone visits a URL that does not exist,
 * this friendly page explains what happened and links back home.
 */

import { Link } from 'react-router-dom'

/*
 * NotFoundPage
 *
 * What it does:
 * - Shows a "Page not found" message with a button back to "/".
 *
 * Why we need it:
 * - Better user experience than a blank screen or browser default error.
 */
function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-400">
          404
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-3 text-slate-300">
          The page you are looking for does not exist.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}

export default NotFoundPage

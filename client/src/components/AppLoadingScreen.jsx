/*
 * APP LOADING SCREEN
 *
 * Full-screen branded placeholder shown while Clerk initializes
 * or during sign-in / sign-out redirects — avoids a white flash.
 */

function AppLoadingScreen({ message }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-app px-6 text-fg">
      <p className="text-sm font-medium uppercase tracking-wide text-brand">
        SOVERM
      </p>
      <div
        className="mt-8 h-1 w-28 overflow-hidden rounded-full bg-surface-elevated"
        aria-hidden="true"
      >
        <div className="h-full w-full animate-pulse rounded-full bg-brand/60" />
      </div>
      {message && <p className="mt-4 text-sm text-fg-muted">{message}</p>}
    </div>
  )
}

export default AppLoadingScreen

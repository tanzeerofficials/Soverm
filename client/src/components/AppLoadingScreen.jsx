/*
 * APP LOADING SCREEN
 *
 * Full-screen branded placeholder shown while Clerk initializes
 * or during sign-in / sign-out redirects — avoids a white flash.
 */

function AppLoadingScreen({ message }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0F1C] px-6 text-white">
      <p className="text-sm font-medium uppercase tracking-wide text-emerald-500">
        SOVERM
      </p>
      <div
        className="mt-8 h-1 w-28 overflow-hidden rounded-full bg-[#1A2236]"
        aria-hidden="true"
      >
        <div className="h-full w-full animate-pulse rounded-full bg-emerald-500/60" />
      </div>
      {message && <p className="mt-4 text-sm text-[#9CA3AF]">{message}</p>}
    </div>
  )
}

export default AppLoadingScreen

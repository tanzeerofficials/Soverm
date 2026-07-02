/*
 * HOME PAGE (older marketing-style page)
 *
 * This page is not currently used in App.jsx routes,
 * but it shows early product messaging for Soverm.
 */

/*
 * Home
 *
 * What it does:
 * - Displays a simple marketing layout describing the product.
 *
 * Why it exists:
 * - Useful as a design/content starting point while routes were being built.
 */
function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-start justify-center px-6 py-20">
        <p className="mb-4 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
          AI-powered personal accountant
        </p>
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
          Soverm helps you understand your true financial picture.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Connect bank data, track transactions, and receive proactive
          plain-English insights before small money decisions become big
          surprises.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold">Plaid-ready</h2>
            <p className="mt-2 text-sm text-slate-400">
             Manage your finances with ease.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold">Plaid-ready</h2>
            <p className="mt-2 text-sm text-slate-400">
             Manage your finances with ease.
            </p>
          </div>
      
          
        </div>
      </section>
    </main>
  )
}

export default Home

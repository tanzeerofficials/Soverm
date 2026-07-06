import { useEffect, useState } from 'react'

const GENERATION_STEPS = [
  'Reading your synced transactions',
  'Analyzing spending patterns',
  'Identifying risks and opportunities',
  'Writing your personalized insight',
]

function InsightGeneratingPanel() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    setActiveStep(0)

    const intervalId = setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, GENERATION_STEPS.length - 1))
    }, 2200)

    return () => clearInterval(intervalId)
  }, [])

  return (
    <article
      className="overflow-hidden rounded-xl border border-border-default border-l-4 border-l-ai bg-surface p-5 sm:p-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Generating your financial insight"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ai">Soverm</span>
        <span className="rounded-full border border-ai/30 bg-ai/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-soft">
          Working
        </span>
      </div>

      <div className="mt-5 flex items-start gap-4">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai/20 opacity-70" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full border border-ai/35 bg-ai/10">
            <svg
              className="h-5 w-5 animate-spin text-ai-soft"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
              />
            </svg>
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-fg">Preparing your insight</p>
          <p className="mt-1 text-sm text-fg-muted">
            Soverm is reviewing your recent activity — this usually takes a few seconds.
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {GENERATION_STEPS.map((step, index) => {
          const isComplete = index < activeStep
          const isActive = index === activeStep

          return (
            <li
              key={step}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                isActive
                  ? 'border-ai/35 bg-ai/10 text-fg'
                  : isComplete
                    ? 'border-border-default bg-app/40 text-fg-muted'
                    : 'border-transparent bg-transparent text-fg-subtle'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isComplete
                    ? 'bg-brand/15 text-brand-soft'
                    : isActive
                      ? 'bg-ai/20 text-ai-soft'
                      : 'bg-surface-elevated text-fg-subtle'
                }`}
                aria-hidden="true"
              >
                {isComplete ? '✓' : index + 1}
              </span>
              <span className={isActive ? 'font-medium' : ''}>{step}</span>
            </li>
          )
        })}
      </ol>
    </article>
  )
}

export default InsightGeneratingPanel

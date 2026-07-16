/*
 * SECURITY TRUST SECTION
 *
 * Landing-page block that explains how Soverm handles financial data.
 * Sits above Pricing — sells trust with specifics (read-only, Plaid, disconnect)
 * before SecurityFaq answers individual questions.
 */

const TRUST_PILLARS = [
  {
    title: 'Secured by Plaid',
    description:
      'The same connection technology used by Venmo, Coinbase, and thousands of banks. Your data is encrypted in transit and at rest.',
    icon: (
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    ),
  },
  {
    title: 'Read-only access',
    description:
      'Soverm can view balances and transactions to generate insights. We cannot move money, make payments, or change anything at your bank.',
    icon: (
      <path
        fillRule="evenodd"
        d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
        clipRule="evenodd"
      />
    ),
  },
  {
    title: 'No bank passwords stored',
    description:
      'You log in to your bank through Plaid’s secure window. Soverm never sees, receives, or stores your banking username or password.',
    icon: (
      <path
        fillRule="evenodd"
        d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"
        clipRule="evenodd"
      />
    ),
  },
  {
    title: 'You stay in control',
    description:
      'Disconnect any bank from Profile in one click — it stops syncing and drops out of your Expense Analyzer and category breakdowns, but past insights stay. Delete your entire Soverm account and all stored data whenever you want.',
    icon: (
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    ),
  },
]

const WE_ACCESS = [
  'Account balances',
  'Transaction history (amounts, dates, merchants)',
  'Account names and types',
]

const WE_NEVER = [
  'Bank login credentials',
  'Ability to move or withdraw funds',
  'Selling your data to advertisers',
]

function IconBadge({ children }) {
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10">
      <svg
        className="h-5 w-5 text-brand-soft"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        {children}
      </svg>
    </div>
  )
}

function SecurityTrustSection() {
  return (
    <section className="mx-auto mt-24 max-w-4xl" id="security" aria-labelledby="security-trust-heading">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          Security
        </p>
        <h2
          id="security-trust-heading"
          className="mt-2 text-2xl font-bold text-fg sm:text-3xl"
        >
          Built to help you make it to payday — without touching your money
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">
          Anxious about linking a bank? Fair. Soverm is read-only via Plaid: we coach on what&apos;s
          left and what to do this week. We cannot move money, and you can disconnect anytime.
        </p>
      </div>

      {/* How data flows — visual strip */}
      <div className="mt-10 rounded-xl border border-border-default bg-gradient-to-b from-surface-deep/60 to-surface p-6 sm:p-8">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-fg-subtle">
          How your bank connects
        </p>
        <ol className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
          {[
            { step: '1', label: 'You choose your bank', detail: 'Plaid opens a secure login' },
            { step: '2', label: 'Plaid verifies you', detail: 'Encrypted, bank-grade connection' },
            { step: '3', label: 'Soverm receives data', detail: 'Balances & transactions only' },
          ].map((item) => (
            <li key={item.step} className="flex flex-col items-center text-center">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/40 bg-brand/10 text-sm font-bold text-brand-soft">
                {item.step}
              </span>
              <p className="mt-3 text-sm font-semibold text-fg">{item.label}</p>
              <p className="mt-1 max-w-[12rem] text-xs leading-relaxed text-fg-muted">
                {item.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* Trust pillars */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TRUST_PILLARS.map(({ title, description, icon }) => (
          <article
            key={title}
            className="flex gap-4 rounded-xl border border-border-default bg-surface p-5 text-left transition hover:border-border-hover hover:bg-surface-elevated/40"
          >
            <IconBadge>{icon}</IconBadge>
            <div>
              <h3 className="text-sm font-semibold text-fg">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{description}</p>
            </div>
          </article>
        ))}
      </div>

      {/* What we access vs never */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-soft">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            What Soverm can see
          </h3>
          <ul className="mt-3 space-y-2">
            {WE_ACCESS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-fg-muted">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-brand-soft" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border-default bg-surface p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <svg className="h-4 w-4 text-fg-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            What Soverm never touches
          </h3>
          <ul className="mt-3 space-y-2">
            {WE_NEVER.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-fg-muted">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-fg-subtle" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Plaid partnership */}
      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-xl border border-border-default bg-app px-6 py-5 sm:flex-row sm:gap-4">
        <p className="text-center text-sm text-fg-muted sm:text-left">
          Bank connections are powered by{' '}
          <span className="font-medium text-fg">Plaid</span> — trusted by over 12,000
          financial institutions worldwide.
        </p>
        <a
          href="https://plaid.com/safety/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-border-default bg-white px-3 py-1.5 transition hover:bg-neutral-100"
          aria-label="Learn about Plaid security (opens in new tab)"
        >
          <img
            src="/plaid-logo.svg"
            alt="Plaid"
            className="h-3.5 w-auto"
            width={37}
            height={14}
          />
        </a>
      </div>
    </section>
  )
}

export default SecurityTrustSection

/*
 * SECURITY & FAQ
 *
 * Landing-page accordion answering common security questions in plain English.
 * Placed after the trust headline section — that section sells the idea;
 * this one answers specific questions without repeating the same bullets.
 */

const FAQ_ITEMS = [
  {
    question: 'Can Soverm see my bank login?',
    answer:
      'No. Plaid handles the connection — Soverm never sees or stores your bank credentials.',
  },
  {
    question: 'Can Soverm move my money?',
    answer:
      'No. Soverm is read-only. It can only view your transactions and balances.',
  },
  {
    question: 'Do you sell my data?',
    answer:
      "No. Your financial data is never sold, rented, or shared with advertisers. It's used only to generate your personal insights — nothing else.",
  },
  {
    question: 'What does the AI actually see?',
    answer:
      "Your transaction descriptions, amounts, and account balances. This data is sent to Anthropic's API to generate your insight, then stored securely in your account. It's never shared with other users, sold to advertisers, or used to train AI models.",
  },
  {
    question: 'Can I disconnect my bank anytime?',
    answer:
      'Yes — from your dashboard or Settings at any time. Disconnecting removes Soverm\'s access immediately and stops all future syncing. That account\'s spending is removed from your Expense Analyzer and category breakdowns going forward. Your past insights and transaction history are kept and won\'t be deleted unless you delete your account.',
  },
  {
    question: 'Can I delete my Soverm account and all my data?',
    answer:
      'Yes. Go to Settings → Delete my account. You must type DELETE to confirm. This permanently removes your profile, bank links, transactions, insights, and chat history, and deletes your login. See our Privacy Policy for the full list.',
  },
  {
    question: 'Is this a bank or a financial institution?',
    answer:
      "No. Soverm is a financial intelligence tool, not a bank. We don't hold, move, or manage your money — we only read your transaction data to help you understand it. The insights Soverm provides are for informational purposes and not financial advice.",
  },
]

function SecurityFaq() {
  return (
    <section className="mx-auto mt-24 max-w-2xl" id="faq" aria-labelledby="faq-heading">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">FAQ</p>
        <h2 id="faq-heading" className="mt-2 text-2xl font-bold text-fg sm:text-3xl">
          Security &amp; FAQ
        </h2>
        <p className="mt-3 text-sm text-fg-muted">Straight answers — no fine print.</p>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border-default bg-surface">
        {FAQ_ITEMS.map(({ question, answer }) => (
          <details
            key={question}
            className="group border-b border-border-default last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-sm font-medium text-fg transition hover:bg-surface-elevated/40 [&::-webkit-details-marker]:hidden group-open:text-brand-soft">
              {question}
              <svg
                className="h-4 w-4 flex-shrink-0 text-fg-muted transition-transform group-open:rotate-180 group-open:text-brand-soft"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </summary>
            <p className="px-6 pb-4 text-sm leading-relaxed text-fg-muted">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export default SecurityFaq

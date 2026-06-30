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
    answer: 'No.',
  },
  {
    question: 'What does the AI actually see?',
    answer:
      'Your transaction descriptions, amounts, and account balances — used only to generate your insights. Not shared with other users or third parties beyond Plaid and Anthropic as processors.',
  },
  {
    question: 'Can I disconnect my bank anytime?',
    answer: 'Yes — from your dashboard or Settings. Disconnecting stops future syncing.',
  },
  {
    question: 'Can I delete my Soverm account and all my data?',
    answer:
      'Yes. Go to Settings → Delete my account. You must type DELETE to confirm. This permanently removes your profile, bank links, transactions, insights, and chat history, and deletes your login. See our Privacy Policy for the full list.',
  },
]

function SecurityFaq() {
  return (
    <section className="mx-auto mt-24 max-w-2xl">
      <h2 className="text-center text-2xl font-bold text-[#F9FAFB]">Security &amp; FAQ</h2>
      <p className="mt-3 text-center text-sm text-[#9CA3AF]">
        Straight answers — no fine print.
      </p>

      <div className="mt-8 rounded-xl border border-[#1E2D45] bg-[#111827] px-6">
        {FAQ_ITEMS.map(({ question, answer }) => (
          <details
            key={question}
            className="group border-b border-[#1E2D45] last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-[#F9FAFB] [&::-webkit-details-marker]:hidden">
              {question}
              <svg
                className="h-4 w-4 flex-shrink-0 text-[#9CA3AF] transition-transform group-open:rotate-180"
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
            <p className="pb-4 text-sm leading-relaxed text-[#9CA3AF]">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export default SecurityFaq

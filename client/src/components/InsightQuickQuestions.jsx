import { buildQuickQuestions } from '../lib/insightDisplay.js'

/*
 * Quick question chips under an insight.
 * Always hand off to the shared Ask Soverm FAB thread (onAskQuestion).
 */
function InsightQuickQuestions({ insight, onAskQuestion }) {
  const questions = buildQuickQuestions(insight)

  if (typeof onAskQuestion !== 'function') {
    return null
  }

  return (
    <section className="mt-4">
      <p className="text-xs uppercase text-fg-muted">Quick questions</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onAskQuestion(question)}
            className="max-w-full rounded-full bg-app px-3 py-2 text-left text-xs leading-snug text-fg-muted transition hover:bg-surface-elevated hover:text-fg sm:py-1.5"
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  )
}

export default InsightQuickQuestions

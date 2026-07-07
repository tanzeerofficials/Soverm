import ChatBubbleIcon from './ChatBubbleIcon.jsx'

function ChatWithCfoButton({ variant = 'full', onClick, className = '' }) {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Ask Soverm"
        className={`flex min-h-11 items-center gap-1.5 rounded-lg border border-ai/40 bg-ai/10 px-3 py-2 text-xs font-medium text-ai-soft transition hover:border-ai/60 hover:bg-ai/20 sm:text-sm ${className}`}
      >
        <ChatBubbleIcon className="h-4 w-4 flex-shrink-0 text-ai" />
        <span className="hidden sm:inline">Ask Soverm</span>
        <span className="sm:hidden">Ask</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ask Soverm"
      className={`flex w-full items-center justify-center gap-2 rounded-xl border border-border-default border-l-4 border-l-ai bg-surface px-6 py-4 text-sm font-medium text-fg transition hover:bg-surface-elevated ${className}`}
    >
      <ChatBubbleIcon className="h-5 w-5 flex-shrink-0 text-ai" />
      Ask Soverm
    </button>
  )
}

export default ChatWithCfoButton

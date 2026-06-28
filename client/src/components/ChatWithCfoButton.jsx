import ChatBubbleIcon from './ChatBubbleIcon.jsx'

function ChatWithCfoButton({ variant = 'full', onClick, className = '' }) {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 px-3 py-1.5 text-xs font-medium text-[#C4B5FD] transition hover:border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/20 sm:text-sm ${className}`}
      >
        <ChatBubbleIcon className="h-4 w-4 flex-shrink-0 text-[#8B5CF6]" />
        <span className="hidden sm:inline">Chat with your CFO</span>
        <span className="sm:hidden">Chat</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border border-[#1E2D45] border-l-4 border-l-[#8B5CF6] bg-[#111827] px-6 py-4 text-sm font-medium text-[#F9FAFB] transition hover:bg-[#1A2236] ${className}`}
    >
      <ChatBubbleIcon className="h-5 w-5 flex-shrink-0 text-[#8B5CF6]" />
      Chat with your CFO
    </button>
  )
}

export default ChatWithCfoButton

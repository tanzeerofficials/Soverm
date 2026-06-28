import { SignOutButton, useUser } from '@clerk/clerk-react'
import ChatWithCfoButton from './ChatWithCfoButton.jsx'

function AppNavbar({ leftContent, onChatClick, children }) {
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  const initials = firstName.charAt(0).toUpperCase()

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#1E2D45] bg-[#0A0F1C]">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4">
          {leftContent}
          {onChatClick && (
            <ChatWithCfoButton variant="compact" onClick={onChatClick} />
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {children}
          <span className="hidden text-sm text-[#9CA3AF] md:inline">{firstName}</span>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A2236] text-sm font-semibold text-[#10B981] ring-1 ring-[#1E2D45]"
            aria-hidden="true"
          >
            {initials}
          </div>
          <SignOutButton>
            <button
              type="button"
              className="rounded-lg border border-[#1E2D45] bg-[#111827] px-3 py-1.5 text-xs font-medium text-[#F9FAFB] transition hover:bg-[#1A2236] sm:px-4 sm:text-sm"
            >
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </div>
    </header>
  )
}

export default AppNavbar

import { SignOutButton, useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import ChatWithCfoButton from './ChatWithCfoButton.jsx'

function AppNavbar({ leftContent, onChatClick, children }) {
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  const initials = firstName.charAt(0).toUpperCase()

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 overflow-x-hidden border-b border-[#1E2D45] bg-[#0A0F1C]">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          {leftContent}
          {onChatClick && (
            <ChatWithCfoButton variant="compact" onClick={onChatClick} />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {children}
          <Link
            to="/settings"
            className="shrink-0 text-xs text-[#9CA3AF] transition hover:text-white sm:text-sm"
            aria-label="Settings"
          >
            <span className="sm:hidden" aria-hidden="true">
              ⚙
            </span>
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <span className="hidden text-sm text-[#9CA3AF] md:inline">{firstName}</span>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A2236] text-sm font-semibold text-[#10B981] ring-1 ring-[#1E2D45]"
            aria-hidden="true"
          >
            {initials}
          </div>
          <SignOutButton>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-[#1E2D45] bg-[#111827] px-2.5 py-2 text-xs font-medium text-[#F9FAFB] transition hover:bg-[#1A2236] sm:px-4 sm:text-sm"
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

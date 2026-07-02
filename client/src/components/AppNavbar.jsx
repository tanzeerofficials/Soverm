import { useEffect, useId, useState } from 'react'
import { SignOutButton, useUser } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'
import ChatWithCfoButton from './ChatWithCfoButton.jsx'
import ChatBubbleIcon from './ChatBubbleIcon.jsx'

function MenuToggleIcon({ open }) {
  if (open) {
    return (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
      </svg>
    )
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5.5A.75.75 0 012.75 10h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10.25zM2.75 15.5a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function BackArrowIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function AppNavbar({ leftContent, onChatClick, backTo, backLabel, children }) {
  const menuId = useId()
  const location = useLocation()
  const { user } = useUser()
  const [menuOpen, setMenuOpen] = useState(false)

  const firstName = user?.firstName ?? 'there'
  const initials = firstName.charAt(0).toUpperCase()
  const mobileBackNav = Boolean(backTo && backLabel)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  function handleChatClick() {
    onChatClick?.()
    setMenuOpen(false)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#1E2D45] bg-[#0A0F1C]">
      <div className="relative mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        {/* Mobile / tablet: compact left zone */}
        <div className="flex min-w-0 items-center lg:hidden">
          {mobileBackNav ? (
            <Link
              to={backTo}
              className="flex min-w-0 items-center gap-1.5 text-sm text-[#9CA3AF] transition hover:text-white"
            >
              <BackArrowIcon />
              <span className="truncate">{backLabel}</span>
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="truncate text-sm font-semibold uppercase tracking-[0.35em] text-[#10B981]"
            >
              Soverm
            </Link>
          )}
        </div>

        {/* Desktop: full left zone */}
        <div className="hidden min-w-0 items-center gap-2 lg:flex lg:gap-4">
          {leftContent && (
            <div className="flex min-w-0 items-center gap-2 lg:gap-4">{leftContent}</div>
          )}
          {onChatClick && <ChatWithCfoButton variant="compact" onClick={onChatClick} />}
        </div>

        {/* Desktop: inline actions */}
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {children}
          <Link
            to="/settings"
            className="shrink-0 text-sm text-[#9CA3AF] transition hover:text-white"
          >
            Settings
          </Link>
          <span className="hidden text-sm text-[#9CA3AF] xl:inline">{firstName}</span>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A2236] text-sm font-semibold text-[#10B981] ring-1 ring-[#1E2D45]"
            aria-hidden="true"
          >
            {initials}
          </div>
          <SignOutButton>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-[#1E2D45] bg-[#111827] px-4 py-2 text-sm font-medium text-[#F9FAFB] transition hover:bg-[#1A2236]"
            >
              Sign Out
            </button>
          </SignOutButton>
        </div>

        {/* Mobile / tablet: menu toggle */}
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1E2D45] bg-[#111827] text-[#9CA3AF] transition hover:bg-[#1A2236] hover:text-white lg:hidden"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuToggleIcon open={menuOpen} />
        </button>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-16 z-40 bg-black/50 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />

          <nav
            id={menuId}
            className="absolute right-0 top-full z-50 w-full border-b border-[#1E2D45] bg-[#111827] shadow-2xl sm:right-4 sm:w-72 sm:rounded-b-xl sm:border sm:border-t-0 lg:hidden"
            aria-label="App navigation"
          >
            <div className="flex items-center gap-3 border-b border-[#1E2D45] px-4 py-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1A2236] text-sm font-semibold text-[#10B981] ring-1 ring-[#1E2D45]"
                aria-hidden="true"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#F9FAFB]">{firstName}</p>
                <p className="truncate text-xs text-[#9CA3AF]">Signed in</p>
              </div>
            </div>

            <div className="py-2">
              {onChatClick && (
                <button
                  type="button"
                  onClick={handleChatClick}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#F9FAFB] transition hover:bg-[#1A2236]"
                >
                  <ChatBubbleIcon className="h-5 w-5 flex-shrink-0 text-[#8B5CF6]" />
                  Ask Soverm
                </button>
              )}

              {children && (
                <div className="[&_a]:flex [&_a]:w-full [&_a]:items-center [&_a]:px-4 [&_a]:py-3 [&_a]:text-sm [&_a]:text-[#F9FAFB] [&_a]:transition hover:[&_a]:bg-[#1A2236]">
                  {children}
                </div>
              )}

              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center px-4 py-3 text-sm text-[#F9FAFB] transition hover:bg-[#1A2236]"
              >
                Settings
              </Link>
            </div>

            <div className="border-t border-[#1E2D45] py-2">
              <SignOutButton>
                <button
                  type="button"
                  className="flex w-full items-center px-4 py-3 text-left text-sm font-medium text-[#F87171] transition hover:bg-[#1A2236]"
                >
                  Sign Out
                </button>
              </SignOutButton>
            </div>
          </nav>
        </>
      )}
    </header>
  )
}

export default AppNavbar

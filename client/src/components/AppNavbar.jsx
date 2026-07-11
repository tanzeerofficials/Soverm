import { useEffect, useId, useState } from 'react'
import { SignOutButton, useUser } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'
import ChatWithCfoButton from './ChatWithCfoButton.jsx'
import ChatBubbleIcon from './ChatBubbleIcon.jsx'
import NotificationBell from './NotificationBell.jsx'
import BrandMark from './BrandMark.jsx'

const PRIMARY_NAV = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    match: (path) => path === '/dashboard',
  },
  {
    to: '/weekly-review',
    label: 'Your week',
    shortLabel: 'Week',
    match: (path) => path.startsWith('/weekly-review'),
  },
  {
    to: '/month-condition',
    label: 'Month letter',
    shortLabel: 'Letter',
    match: (path) => path.startsWith('/month-condition'),
  },
  {
    to: '/expense-analyzer',
    label: 'Expenses',
    shortLabel: 'Expenses',
    match: (path) => path.startsWith('/expense-analyzer'),
  },
  {
    to: '/history',
    label: 'History',
    shortLabel: 'History',
    match: (path) => path.startsWith('/history'),
  },
  {
    to: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    match: (path) => path.startsWith('/settings'),
  },
]

function NavIcon({ name, className = 'h-4 w-4' }) {
  const props = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (name === 'dashboard') {
    return (
      <svg {...props}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
      </svg>
    )
  }

  if (name === 'expenses') {
    return (
      <svg {...props}>
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 5 5-7" />
      </svg>
    )
  }

  if (name === 'history') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }

  if (name === 'week') {
    return (
      <svg {...props}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    )
  }

  if (name === 'month') {
    return (
      <svg {...props}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    )
  }

  if (name === 'settings') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    )
  }

  return null
}

const NAV_ICONS = {
  '/dashboard': 'dashboard',
  '/weekly-review': 'week',
  '/month-condition': 'month',
  '/expense-analyzer': 'expenses',
  '/history': 'history',
  '/settings': 'settings',
}

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
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function NavPill({ to, label, shortLabel, icon, active, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200 xl:px-4 ${
        active
          ? 'bg-surface-elevated text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-brand/35'
          : 'text-fg-muted hover:bg-surface-elevated/55 hover:text-fg'
      }`}
    >
      <NavIcon name={icon} className={`h-4 w-4 shrink-0 ${active ? 'text-brand-soft' : ''}`} />
      <span className="hidden xl:inline">{label}</span>
      <span className="xl:hidden">{shortLabel || label}</span>
    </Link>
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

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border-default/70 bg-app/88 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent" />

      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-6 lg:gap-6">
        {/* Brand + optional page context */}
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
          <div className="lg:hidden">
            {mobileBackNav ? (
              <Link
                to={backTo}
                className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-fg-muted transition hover:text-fg"
              >
                <BackArrowIcon />
                <span className="truncate">{backLabel}</span>
              </Link>
            ) : (
              <BrandMark compact />
            )}
          </div>

          <div className="hidden lg:flex lg:items-center lg:gap-4">
            <BrandMark />
            {leftContent && (
              <>
                <span className="h-6 w-px bg-border-default" aria-hidden="true" />
                <div className="min-w-0 text-sm text-fg-muted">{leftContent}</div>
              </>
            )}
          </div>
        </div>

        {/* Desktop center navigation */}
        <nav
          className="hidden items-center gap-1 rounded-full border border-border-default/80 bg-surface/70 p-1 lg:flex"
          aria-label="Primary"
        >
          {PRIMARY_NAV.map((item) => (
            <NavPill
              key={item.to}
              to={item.to}
              label={item.label}
              shortLabel={item.shortLabel}
              icon={NAV_ICONS[item.to]}
              active={item.match(location.pathname)}
            />
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden shrink-0 items-center gap-2 lg:flex lg:gap-3">
          {children}
          {onChatClick && <ChatWithCfoButton variant="compact" onClick={onChatClick} />}

          <span className="mx-0.5 h-6 w-px bg-border-default" aria-hidden="true" />

          <NotificationBell />

          <div className="flex items-center gap-2.5 rounded-full border border-border-default bg-surface/80 py-1 pl-1 pr-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-surface-elevated to-surface text-sm font-semibold text-brand-soft ring-1 ring-border-default"
              aria-hidden="true"
            >
              {initials}
            </div>
            <span className="hidden max-w-[7rem] truncate text-sm text-fg-muted xl:inline">
              {firstName}
            </span>
          </div>

          <SignOutButton>
            <button
              type="button"
              className="rounded-full border border-border-default bg-surface/80 px-4 py-2 text-sm font-medium text-fg-muted transition hover:border-border-default hover:bg-surface-elevated hover:text-fg"
            >
              Sign out
            </button>
          </SignOutButton>
        </div>

        {/* Mobile actions */}
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <NotificationBell />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-surface text-fg-muted transition hover:border-border-default hover:bg-surface-elevated hover:text-fg"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuToggleIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-16 z-40 bg-black/55 backdrop-blur-[2px] lg:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />

          <nav
            id={menuId}
            className="absolute inset-x-3 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-border-default bg-surface/95 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-4 sm:w-80 lg:hidden"
            aria-label="App navigation"
          >
            <div className="border-b border-border-default bg-gradient-to-r from-surface-elevated to-surface px-4 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-elevated to-app text-sm font-semibold text-brand-soft ring-1 ring-border-default"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{firstName}</p>
                  <p className="truncate text-xs text-fg-muted">Signed in to Soverm</p>
                </div>
              </div>
            </div>

            <div className="p-2">
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-fg-subtle">
                Navigate
              </p>
              {PRIMARY_NAV.map((item) => {
                const active = item.match(location.pathname)

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={closeMenu}
                    aria-current={active ? 'page' : undefined}
                    className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                      active
                        ? 'bg-surface-elevated text-fg ring-1 ring-brand/30'
                        : 'text-fg-muted hover:bg-surface-elevated/70'
                    }`}
                  >
                    <NavIcon
                      name={NAV_ICONS[item.to]}
                      className={`h-5 w-5 shrink-0 ${active ? 'text-brand-soft' : 'text-fg-subtle'}`}
                    />
                    {item.label}
                  </Link>
                )
              })}

              {children && (
                <div className="mt-2 border-t border-border-default pt-2 [&_a]:mb-1 [&_a]:flex [&_a]:items-center [&_a]:rounded-xl [&_a]:px-3 [&_a]:py-3 [&_a]:text-sm [&_a]:font-medium [&_a]:text-fg-muted [&_a]:transition hover:[&_a]:bg-surface-elevated/70">
                  {children}
                </div>
              )}
            </div>

            {onChatClick && (
              <div className="border-t border-border-default p-3">
                <button
                  type="button"
                  onClick={handleChatClick}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-ai/35 bg-ai/10 px-4 py-3 text-sm font-medium text-ai-soft transition hover:bg-ai/20"
                >
                  <ChatBubbleIcon className="h-5 w-5 shrink-0 text-ai" />
                  Ask Soverm
                </button>
              </div>
            )}

            <div className="border-t border-border-default p-2">
              <SignOutButton>
                <button
                  type="button"
                  className="flex w-full items-center rounded-xl px-3 py-3 text-left text-sm font-medium text-danger transition hover:bg-danger/10"
                >
                  Sign out
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

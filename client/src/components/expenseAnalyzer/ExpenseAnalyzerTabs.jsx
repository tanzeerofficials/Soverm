/*
 * EXPENSE ANALYZER TABS
 *
 * Tab bar for switching between summary, overview charts, category breakdown,
 * and recurring charges on the Expense Analyzer page.
 *
 * Mobile: horizontally scrollable strip with snap points and 44px+ touch targets.
 * Desktop: equal-width four-column grid.
 */

export const EXPENSE_ANALYZER_TABS = {
  SUMMARY: 'summary',
  OVERVIEW: 'overview',
  CATEGORIES: 'categories',
  RECURRING: 'recurring',
}

function tabCountLabel(count) {
  if (!count || count <= 0) {
    return null
  }

  return count > 99 ? '99+' : String(count)
}

function TabIcon({ id, active }) {
  const stroke = active ? '#34D399' : '#6B7280'

  if (id === EXPENSE_ANALYZER_TABS.SUMMARY) {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    )
  }

  if (id === EXPENSE_ANALYZER_TABS.OVERVIEW) {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 5 5-7" />
      </svg>
    )
  }

  if (id === EXPENSE_ANALYZER_TABS.CATEGORIES) {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function ExpenseAnalyzerTabBar({
  activeTab,
  onChange,
  categoryCount = 0,
  recurringCount = 0,
  summaryReady = false,
}) {
  const tabs = [
    {
      id: EXPENSE_ANALYZER_TABS.OVERVIEW,
      label: 'Overview',
      shortLabel: 'Charts',
    },
    {
      id: EXPENSE_ANALYZER_TABS.SUMMARY,
      label: 'Summary',
      shortLabel: 'Summary',
    },
    {
      id: EXPENSE_ANALYZER_TABS.CATEGORIES,
      label: 'Categories',
      shortLabel: 'Categories',
      count: categoryCount,
    },
    {
      id: EXPENSE_ANALYZER_TABS.RECURRING,
      label: 'Recurring',
      shortLabel: 'Recurring',
      count: recurringCount,
    },
  ]

  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-2xl border border-[#1E2D45] bg-gradient-to-b from-[#131B2E] to-[#0D1320] shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        role="tablist"
        aria-label="Expense analyzer sections"
      >
        <div
          className="flex gap-1 overflow-x-auto p-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const countLabel = tabCountLabel(tab.count)
            const showSummaryDot =
              tab.id === EXPENSE_ANALYZER_TABS.SUMMARY && summaryReady && !isActive

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`expense-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`expense-panel-${tab.id}`}
                onClick={() => onChange(tab.id)}
                className={`group relative flex min-h-11 min-w-[5.75rem] flex-1 snap-center flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2.5 transition-all duration-200 sm:min-w-0 sm:flex-row sm:gap-2 sm:px-3 sm:py-3 ${
                  isActive
                    ? 'bg-[#1A2236] text-[#F9FAFB] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-emerald-500/35'
                    : 'text-[#9CA3AF] hover:bg-[#1A2236]/50 hover:text-[#E5E7EB] active:scale-[0.98]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <TabIcon id={tab.id} active={isActive} />
                  {showSummaryDot && (
                    <span
                      className="absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-400 sm:left-auto sm:right-2 sm:top-2 sm:translate-x-0"
                      aria-hidden="true"
                    />
                  )}
                </span>

                <span className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold leading-none sm:text-sm">
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </span>
                  {countLabel && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-[#0A0F1C] text-[#6B7280] group-hover:text-[#9CA3AF]'
                      }`}
                    >
                      {countLabel}
                    </span>
                  )}
                </span>

                {isActive && (
                  <span
                    className="absolute inset-x-3 bottom-1 hidden h-0.5 rounded-full bg-gradient-to-r from-emerald-400/0 via-emerald-400 to-emerald-400/0 sm:block"
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-[#6B7280] sm:hidden">
        Swipe to see all sections
      </p>
    </div>
  )
}

function ExpenseAnalyzerTabPanel({ tabId, activeTab, children, className = '' }) {
  if (activeTab !== tabId) {
    return null
  }

  return (
    <div
      id={`expense-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`expense-tab-${tabId}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}

export { ExpenseAnalyzerTabBar, ExpenseAnalyzerTabPanel }

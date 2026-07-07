/*
 * DASHBOARD TABS
 *
 * Overview — balance hero, spending snapshot, actions, connected banks.
 * Insight — AI insight, action checklist, chat.
 * Tools — recent transactions, period comparison, account health.
 */

export const DASHBOARD_TABS = {
  OVERVIEW: 'overview',
  INSIGHT: 'insight',
  TOOLS: 'tools',
}

function TabIcon({ id, active }) {
  const iconClass = active ? 'text-brand-soft' : 'text-fg-subtle'

  if (id === DASHBOARD_TABS.OVERVIEW) {
    return (
      <svg
        aria-hidden="true"
        className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${iconClass}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 5 5-7" />
      </svg>
    )
  }

  if (id === DASHBOARD_TABS.TOOLS) {
    return (
      <svg
        aria-hidden="true"
        className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${iconClass}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${iconClass}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  )
}

function DashboardTabBar({
  activeTab,
  onChange,
  overviewSetupPending = false,
  insightAttentionPending = false,
}) {
  const tabs = [
    {
      id: DASHBOARD_TABS.OVERVIEW,
      label: 'Overview',
      shortLabel: 'Overview',
      showDot: overviewSetupPending && activeTab !== DASHBOARD_TABS.OVERVIEW,
    },
    {
      id: DASHBOARD_TABS.INSIGHT,
      label: 'Insight',
      shortLabel: 'Insight',
      showDot: insightAttentionPending && activeTab !== DASHBOARD_TABS.INSIGHT,
    },
    {
      id: DASHBOARD_TABS.TOOLS,
      label: 'Quick tools',
      shortLabel: 'Tools',
      showDot: false,
    },
  ]

  return (
    <div className="relative mt-6">
      <div
        className="overflow-hidden rounded-2xl border border-border-default bg-gradient-to-b from-surface-deep to-app shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        role="tablist"
        aria-label="Dashboard sections"
      >
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`dashboard-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`dashboard-panel-${tab.id}`}
                onClick={() => onChange(tab.id)}
                className={`group relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2.5 transition-all duration-200 sm:flex-row sm:gap-2 sm:py-3 ${
                  isActive
                    ? 'bg-surface-elevated text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-brand/35'
                    : 'text-fg-muted hover:bg-surface-elevated/50 hover:text-fg active:scale-[0.98]'
                }`}
              >
                <span className="relative flex items-center gap-1.5">
                  <TabIcon id={tab.id} active={isActive} />
                  {tab.showDot && (
                    <span
                      className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand-soft ring-2 ring-surface-deep"
                      aria-hidden="true"
                    />
                  )}
                </span>

                <span className="text-[11px] font-semibold leading-none sm:text-sm">
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>

                {isActive && (
                  <span
                    className="absolute inset-x-4 bottom-1 hidden h-0.5 rounded-full bg-gradient-to-r from-brand-soft/0 via-brand-soft to-brand-soft/0 sm:block"
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DashboardTabPanel({ tabId, activeTab, children, className = '' }) {
  if (activeTab !== tabId) {
    return null
  }

  return (
    <div
      id={`dashboard-panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`dashboard-tab-${tabId}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}

export { DashboardTabBar, DashboardTabPanel }

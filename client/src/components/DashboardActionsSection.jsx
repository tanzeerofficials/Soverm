/*
 * DASHBOARD ACTIONS SECTION
 *
 * Connect, sync, and generate — sits above connected account cards on Overview.
 */

import ConnectBankButton from './ConnectBankButton.jsx'
import SyncTransactionsButton from './SyncTransactionsButton.jsx'
import GenerateInsightButton from './GenerateInsightButton.jsx'

function DashboardActionsSection({
  showToast,
  highlightedConnect,
  highlightedGenerate,
  onInsightError,
  onInsightLoadingChange,
  onLimitReached,
  onUsageUpdated,
}) {
  return (
    <section id="dashboard-actions" aria-label="Dashboard actions">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="w-full sm:flex-1">
          <ConnectBankButton
            className="w-full"
            highlighted={highlightedConnect}
            showSecurityNote={false}
          />
        </div>
        <div className="w-full sm:flex-1">
          <SyncTransactionsButton className="w-full" showToast={showToast} />
        </div>
        <div id="generate-insight-action" className="w-full sm:flex-1">
          <GenerateInsightButton
            className="w-full"
            showCard={false}
            showToast={showToast}
            highlighted={highlightedGenerate}
            onError={onInsightError}
            onLoadingChange={onInsightLoadingChange}
            onLimitReached={onLimitReached}
            onUsageUpdated={onUsageUpdated}
          />
        </div>
      </div>
    </section>
  )
}

export default DashboardActionsSection

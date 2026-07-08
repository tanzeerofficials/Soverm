/*
 * DASHBOARD ACTIONS SECTION
 *
 * Connect, sync, and optionally generate — Overview shows connect + sync;
 * Insight tab adds generate.
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
  showConnectBank = true,
  showGenerateInsight = true,
  sectionId = 'dashboard-actions',
  generateActionId = 'generate-insight-action',
  insightLoading = false,
}) {
  return (
    <section id={sectionId} aria-label="Dashboard actions">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {showConnectBank && (
          <div className="w-full sm:flex-1">
            <ConnectBankButton
              className="w-full"
              highlighted={highlightedConnect}
              showSecurityNote={false}
            />
          </div>
        )}
        <div className="w-full sm:flex-1">
          <SyncTransactionsButton className="w-full" showToast={showToast} />
        </div>
        {showGenerateInsight && (
          <div id={generateActionId} className="w-full sm:flex-1">
            <GenerateInsightButton
              className="w-full"
              showCard={false}
              showToast={showToast}
              highlighted={highlightedGenerate}
              isLoading={insightLoading}
              onError={onInsightError}
              onLoadingChange={onInsightLoadingChange}
              onLimitReached={onLimitReached}
              onUsageUpdated={onUsageUpdated}
            />
          </div>
        )}
      </div>
    </section>
  )
}

export default DashboardActionsSection

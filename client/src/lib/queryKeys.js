/*
 * React Query keys + shared invalidation helpers.
 *
 * Keep list/detail variants under a shared prefix so invalidateQueries({ queryKey: prefix })
 * refreshes every related cache entry.
 */

export const dashboardQueryKey = ['dashboard']

/** Range-scoped dashboard summary — Settings uses the default 30d window. */
export function dashboardSummaryQueryKey(range = '30d') {
  return ['dashboard', 'summary', range]
}

export const historyQueryKey = ['history']
export const expenseAnalyzerQueryKey = ['expense-analyzer']
export const expenseAnalyzerSummaryQueryKey = ['expense-analyzer', 'summary']
export const expenseAnalyzerNarrativeQueryKey = ['expense-analyzer', 'narrative']
export const usageQueryKey = ['usage']

/** Prefix — invalidate this to refresh all / unread notification caches. */
export const notificationsQueryKey = ['notifications']
export const notificationsAllQueryKey = ['notifications', 'all']
export const notificationsUnreadQueryKey = ['notifications', 'unread']

export const trackerQueryKey = ['trackers']
export const categoryLimitsQueryKey = ['category-limits']
export const paydayQueryKey = ['payday']
export const weeklyReviewQueryKey = ['weekly-review']
export const monthConditionQueryKey = (monthKey = 'current') => ['month-condition', monthKey]
export const cashFlowForecastQueryKey = ['dashboard', 'forecast']

/** Shared thread when chatting without a weekly insight. */
export const GENERAL_CHAT_KEY = 'general'

export const chatQueryKey = (threadId) => ['chat', threadId ?? GENERAL_CHAT_KEY]
export const chatLimitsQueryKey = ['chat', 'limits']

/**
 * After connect, disconnect, or sync — refresh every surface that depends on
 * accounts / transactions / alerts.
 */
export async function invalidateAfterAccountChange(queryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: dashboardQueryKey }),
    queryClient.invalidateQueries({ queryKey: trackerQueryKey }),
    queryClient.invalidateQueries({ queryKey: paydayQueryKey }),
    queryClient.invalidateQueries({ queryKey: weeklyReviewQueryKey }),
    queryClient.invalidateQueries({ queryKey: ['month-condition'] }),
    queryClient.invalidateQueries({ queryKey: cashFlowForecastQueryKey }),
    queryClient.invalidateQueries({ queryKey: expenseAnalyzerQueryKey }),
    queryClient.invalidateQueries({ queryKey: expenseAnalyzerSummaryQueryKey }),
    queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  ])
}

import { formatCategoryDisplayName } from '../../lib/categoryDisplayNames.js'
import {
  formatCategoryAccountSources,
  formatRecurringAccountSource,
} from '../../lib/accountAttribution.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function AccountSourceLine({ sources }) {
  if (!sources) {
    return null
  }

  if (sources.type === 'single') {
    return <p className="text-xs text-[#6B7280]">{sources.label}</p>
  }

  if (sources.type === 'combined') {
    return <p className="text-xs text-[#6B7280]">{sources.label}</p>
  }

  return (
    <p className="text-xs leading-relaxed text-[#6B7280]">
      {sources.entries.map((entry, index) => (
        <span key={`${entry.label}-${index}`}>
          {index > 0 ? ' · ' : ''}
          {entry.label}
          {entry.total != null ? `: ${formatCurrency(entry.total)}` : ''}
        </span>
      ))}
    </p>
  )
}

export function CategoryMetaBadges({ percentOfTotal, recurringCount }) {
  if (percentOfTotal <= 0 && recurringCount <= 0) {
    return null
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {percentOfTotal > 0 && (
        <span className="rounded-full border border-[#1E2D45] bg-[#0A0F1C]/60 px-2 py-0.5 text-[11px] text-[#9CA3AF]">
          {percentOfTotal}% of spend
        </span>
      )}
      {recurringCount > 0 && (
        <span className="rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-2 py-0.5 text-[11px] font-medium text-[#C4B5FD]">
          {recurringCount} recurring
        </span>
      )}
    </div>
  )
}

export function CategoryRecurringLine({ recurringMonthly }) {
  if (!recurringMonthly || recurringMonthly <= 0) {
    return null
  }

  return (
    <p className="text-xs text-[#8B5CF6]">
      Recurring {formatCurrency(recurringMonthly)}/mo
    </p>
  )
}

export {
  formatCategoryDisplayName,
  formatCategoryAccountSources,
  formatRecurringAccountSource,
  formatCurrency,
}

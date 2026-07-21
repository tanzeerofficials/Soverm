/*
 * Shared USD currency formatter for the client.
 *
 * Null/undefined/NaN amounts default to $0 so UI never renders literal $NaN.
 * Intl.NumberFormat handles negatives correctly (-$5, not $-5).
 *
 * Options:
 * - nullAs: string shown when amount is null/undefined/non-finite (e.g. '—'),
 *   or number fallback (default 0)
 * - any other keys are passed through to Intl.NumberFormat
 */

export function formatCurrency(amount, options = {}) {
  const { nullAs = 0, ...intlOptions } = options
  const numeric = amount == null ? null : Number(amount)
  const isMissing = numeric == null || !Number.isFinite(numeric)

  if (isMissing && typeof nullAs === 'string') {
    return nullAs
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    ...intlOptions,
  }).format(isMissing ? (typeof nullAs === 'number' ? nullAs : 0) : numeric)
}

function formatPersonalFinanceCategoryPrimary(primary) {
  return primary
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

export function resolvePlaidTransactionCategory(transaction) {
  const primary = transaction?.personal_finance_category?.primary

  if (primary) {
    return formatPersonalFinanceCategoryPrimary(primary)
  }

  if (Array.isArray(transaction?.category) && transaction.category.length > 0) {
    return transaction.category[0]
  }

  return null
}

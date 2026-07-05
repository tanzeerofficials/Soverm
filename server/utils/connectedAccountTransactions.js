/**
 * SQL fragments for Expense Analyzer queries.
 *
 * Only transactions linked to an account whose Plaid Item still exists are included.
 * On disconnect, account_id is nulled and account/plaid_item rows are removed — those
 * transactions stay in the DB but drop out of these joins.
 */
export const CONNECTED_ACCOUNT_TRANSACTION_JOINS = `
  INNER JOIN accounts a ON t.account_id = a.id AND a.user_id = t.user_id
  INNER JOIN plaid_items pi ON a.plaid_item_id = pi.id AND pi.user_id = t.user_id
`

export const EXPENSE_ANALYZER_TRANSACTION_SELECT = `
  t.name, t.amount, t.date, t.category, t.pending,
  t.account_id,
  a.account_name,
  a.bank_name
`

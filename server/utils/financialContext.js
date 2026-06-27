import db from '../db/index.js'
import { getDisplayBalance } from './balanceHelpers.js'

export async function loadFinancialContextForUser(userId) {
  const [transactionsResult, accountsResult] = await Promise.all([
    db.query(
      `SELECT t.*,
              a.bank_name,
              COALESCE(a.account_name, 'Disconnected account') AS account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.user_id = $1
       ORDER BY t.date DESC
       LIMIT 50`,
      [userId]
    ),
    db.query(
      `SELECT account_name, account_type, balance_current, balance_available
       FROM accounts
       WHERE user_id = $1`,
      [userId]
    ),
  ])

  const accountSummary = accountsResult.rows
    .map(
      (a) =>
        `${a.account_name} (${a.account_type}): $${getDisplayBalance(a)}`
    )
    .join('\n')

  return {
    transactions: transactionsResult.rows,
    accountSummary,
  }
}

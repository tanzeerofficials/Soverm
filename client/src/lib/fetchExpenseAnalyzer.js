import { authHeaders } from './apiRequest.js'

export async function fetchExpenseAnalyzer(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/expense-analyzer`, {
    headers: authHeaders(token),
  })

  if (!res.ok) {
    throw new Error(`Expense analyzer fetch failed: ${res.status}`)
  }

  return res.json()
}

export async function fetchExpenseAnalyzerSummary(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/expense-analyzer/summary`, {
    headers: authHeaders(token),
  })

  if (!res.ok) {
    throw new Error(`Expense analyzer summary fetch failed: ${res.status}`)
  }

  return res.json()
}

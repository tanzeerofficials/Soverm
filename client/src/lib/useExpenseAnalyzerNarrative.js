import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expenseAnalyzerNarrativeQueryKey } from '../lib/queryKeys.js'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatGeneratedAt(value) {
  if (!value) {
    return null
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function fetchNarrativeCache(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/expense-analyzer/narrative`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Narrative cache fetch failed: ${res.status}`)
  }

  return res.json()
}

async function generatePersonalNarrative(getToken) {
  const token = await getToken()
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/expense-analyzer/narrative`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const error = new Error(data.error || `Narrative generation failed: ${res.status}`)
    error.code = data.code
    throw error
  }

  return data
}

export function useExpenseAnalyzerNarrative({ fingerprint, templateSummary, enabled }) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()

  const cacheQuery = useQuery({
    queryKey: [...expenseAnalyzerNarrativeQueryKey, fingerprint],
    queryFn: () => fetchNarrativeCache(getToken),
    enabled: enabled && Boolean(fingerprint),
    staleTime: 60_000,
  })

  const generateMutation = useMutation({
    mutationFn: () => generatePersonalNarrative(getToken),
    onSuccess: (data) => {
      queryClient.setQueryData([...expenseAnalyzerNarrativeQueryKey, fingerprint], {
        fingerprint: data.fingerprint,
        cached: true,
        narrative: {
          lead: data.lead,
          paragraphs: data.paragraphs,
          generatedAt: data.generatedAt,
          source: data.source,
        },
        templateSummary: data.templateSummary,
        confirmedRecurringMonthly: data.confirmedRecurringMonthly,
      })
    },
  })

  const cachedNarrative = cacheQuery.data?.cached ? cacheQuery.data.narrative : null
  const personalNarrative = generateMutation.data
    ? {
        lead: generateMutation.data.lead,
        paragraphs: generateMutation.data.paragraphs,
        generatedAt: generateMutation.data.generatedAt,
        source: generateMutation.data.source,
      }
    : cachedNarrative
  const showPersonalized = Boolean(personalNarrative?.lead && personalNarrative?.paragraphs?.length)
  const awaitingCacheCheck =
    Boolean(fingerprint) && cacheQuery.isLoading && !generateMutation.data

  return {
    cacheQuery,
    generateMutation,
    personalNarrative,
    showPersonalized,
    awaitingCacheCheck,
    templateSummary: cacheQuery.data?.templateSummary ?? templateSummary,
    confirmedRecurringMonthly: cacheQuery.data?.confirmedRecurringMonthly,
    generatePersonalized: () => generateMutation.mutate(),
    isGenerating: generateMutation.isPending,
    generationError: generateMutation.error,
  }
}

export { formatCurrency, formatGeneratedAt }

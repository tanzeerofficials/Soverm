/*
 * Expense Analyzer chart colors — SVG/Canvas need hex; mirror theme tokens.
 * Use getChartTheme() so light/dark flip with data-theme on <html>.
 */

const DARK_CHART = {
  barSequence: ['#8b5cf6', '#c4b5fd', '#7c3aed', '#a78bfa'],
  track: '#1a2236',
  tick: '#9ca3af',
  value: '#f9fafb',
  sparklinePositive: '#10b981',
  sparklineNegative: '#ef4444',
  sparklineNeutral: '#9ca3af',
}

const LIGHT_CHART = {
  barSequence: ['#7c3aed', '#a78bfa', '#6d28d9', '#c4b5fd'],
  track: '#e4e7ed',
  tick: '#475467',
  value: '#0f172a',
  sparklinePositive: '#059669',
  sparklineNegative: '#dc2626',
  sparklineNeutral: '#6b7688',
}

function readDocumentTheme() {
  if (typeof document === 'undefined') {
    return 'dark'
  }
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

/**
 * What this does: returns chart chrome colors for the active theme.
 * Why: canvas/SVG can't use Tailwind classes; colors must follow data-theme.
 */
export function getChartTheme() {
  return readDocumentTheme() === 'light' ? LIGHT_CHART : DARK_CHART
}

/** @deprecated Prefer getChartTheme().barSequence — dark defaults for older imports */
export const CHART_PURPLE = DARK_CHART.barSequence[0]
export const CHART_PURPLE_SOFT = DARK_CHART.barSequence[1]
export const CHART_PURPLE_MID = DARK_CHART.barSequence[2]
export const CHART_PURPLE_MUTED = DARK_CHART.barSequence[3]

export const CHART_BAR_SEQUENCE = DARK_CHART.barSequence

export const CHART_BAR_TRACK = DARK_CHART.track
export const CHART_TICK = DARK_CHART.tick
export const CHART_VALUE = DARK_CHART.value

export const SPARKLINE_POSITIVE = DARK_CHART.sparklinePositive
export const SPARKLINE_NEGATIVE = DARK_CHART.sparklineNegative
export const SPARKLINE_NEUTRAL = DARK_CHART.sparklineNeutral

/** Shorten long category labels for narrow chart axes. */
export function truncateChartLabel(label, maxLength = 14) {
  const text = String(label ?? '')
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

/*
 * SENTRY (CLIENT)
 *
 * Optional error reporting when VITE_SENTRY_DSN is set. Scrubs sensitive keys
 * before events leave the browser.
 */

import * as Sentry from '@sentry/react'

const SENSITIVE_KEY =
  /authorization|cookie|token|secret|password|api[_-]?key|plaid|account|balance|transaction|message|content|insight|email/i

let initialized = false

function scrubObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null ? scrubObject(item, depth + 1) : item
    )
  }
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[Redacted]'
    } else if (value && typeof value === 'object') {
      out[key] = scrubObject(value, depth + 1)
    } else if (typeof value === 'string' && value.length > 200) {
      out[key] = '[Truncated]'
    } else {
      out[key] = value
    }
  }
  return out
}

function scrubSentryEvent(event) {
  if (event.request?.headers) {
    event.request.headers = scrubObject(event.request.headers)
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra)
  }
  return event
}

export function isSentryEnabled() {
  return initialized && Boolean(import.meta.env.VITE_SENTRY_DSN)
}

export function initSentry() {
  if (initialized) {
    return isSentryEnabled()
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    return false
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  })

  initialized = true
  return true
}

export function captureClientError(err, { label } = {}) {
  if (!isSentryEnabled() || err == null) {
    return
  }

  const error = err instanceof Error ? err : new Error(String(err))

  Sentry.withScope((scope) => {
    if (label) {
      scope.setTag('error_label', label)
    }
    Sentry.captureException(error)
  })
}

export { Sentry }

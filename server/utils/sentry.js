/*
 * SENTRY (SERVER)
 *
 * Optional error reporting when SENTRY_DSN is set. Never ships request bodies,
 * auth headers, or financial fields — see scrubSentryEvent().
 */

import * as Sentry from '@sentry/node'

const SENSITIVE_KEY = /authorization|cookie|token|secret|password|api[_-]?key|plaid|account|balance|transaction|message|content|insight|email/i

function redactValue(key, value) {
  if (SENSITIVE_KEY.test(String(key))) {
    return '[Redacted]'
  }
  if (typeof value === 'string' && value.length > 200) {
    return '[Truncated]'
  }
  return value
}

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
    if (value && typeof value === 'object') {
      out[key] = scrubObject(value, depth + 1)
    } else {
      out[key] = redactValue(key, value)
    }
  }
  return out
}

export function scrubSentryEvent(event) {
  if (event.request) {
    if (event.request.headers) {
      event.request.headers = scrubObject(event.request.headers)
    }
    if (event.request.data) {
      event.request.data = '[Redacted]'
    }
    if (event.request.cookies) {
      event.request.cookies = '[Redacted]'
    }
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra)
  }
  if (event.contexts) {
    event.contexts = scrubObject(event.contexts)
  }
  return event
}

let initialized = false

export function isSentryEnabled() {
  return initialized && Boolean(process.env.SENTRY_DSN)
}

export function initSentry() {
  if (initialized) {
    return isSentryEnabled()
  }

  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    return false
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  })

  initialized = true
  return true
}

export function captureServerError(err, { label, userId, path } = {}) {
  if (!isSentryEnabled() || err == null) {
    return
  }

  const error = err instanceof Error ? err : new Error(String(err))

  Sentry.withScope((scope) => {
    if (label) {
      scope.setTag('error_label', label)
    }
    if (path) {
      scope.setTag('path', path)
    }
    if (userId) {
      scope.setUser({ id: userId })
    }
    Sentry.captureException(error)
  })

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[Sentry] captured: ${label || error.message}`)
  }
}

export function reportServerError(label, err, { userId, req } = {}) {
  console.error(`Failed ${label}:`, err.message)
  captureServerError(err, {
    label,
    userId,
    path: req?.originalUrl || req?.path,
  })
}

export { Sentry }

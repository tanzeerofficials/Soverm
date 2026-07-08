/*
 * INPUT VALIDATION HELPERS
 *
 * Shared checks for URL params and request bodies before they reach
 * database queries or third-party APIs.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const MAX_CHAT_MESSAGE_LENGTH = 4000
export const MAX_PUBLIC_TOKEN_LENGTH = 120

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function validateUuidParam(value, label = 'id') {
  if (!isValidUuid(value)) {
    return { error: `Invalid ${label}` }
  }
  return { value }
}

export function validatePublicToken(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { error: 'public_token is required' }
  }

  const trimmed = value.trim()

  if (trimmed.length > MAX_PUBLIC_TOKEN_LENGTH) {
    return { error: 'public_token is invalid' }
  }

  return { value: trimmed }
}

export function validateBooleanField(value, fieldName) {
  if (typeof value !== 'boolean') {
    return { error: `${fieldName} must be a boolean` }
  }
  return { value }
}

export function validateChatMessage(value) {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return { error: 'Message is required' }
  }

  const trimmed = value.trim()

  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    return { error: `Message must be at most ${MAX_CHAT_MESSAGE_LENGTH} characters` }
  }

  return { value: trimmed }
}

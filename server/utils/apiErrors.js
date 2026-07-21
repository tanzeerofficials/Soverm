/*
 * Client-safe API error messages.
 *
 * Internal details belong in server logs (console.error), not in JSON responses.
 */

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/** Schema/migration/outage responses — never echo internal migration names. */
export const TEMPORARILY_UNAVAILABLE_MESSAGE =
  'This feature is temporarily unavailable. Please try again shortly.'

/*
 * HTML ESCAPE
 *
 * Escapes dynamic strings before they are interpolated into email HTML.
 * Plain-text email bodies should stay unescaped.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

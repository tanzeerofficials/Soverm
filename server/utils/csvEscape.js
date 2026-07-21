/*
 * CSV cell escaping for downloads that may open in Excel / Sheets.
 *
 * Formula injection: cells starting with = + - @ (or tab/CR) are treated as
 * formulas. Bank merchant names can start with those characters — prefix with
 * a single quote so the spreadsheet stores them as text.
 */

export function csvEscape(value) {
  let text = String(value ?? '')

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

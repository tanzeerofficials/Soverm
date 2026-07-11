/*
 * TRANSACTIONAL EMAIL (Resend)
 *
 * Shared send helper for weekly truth letter + month-end accountant letter.
 * Without RESEND_API_KEY + MAIL_FROM, logs a dry-run and returns dryRun: true.
 */

export async function sendTransactionalEmail({ to, subject, text, html, logLabel = 'email' }) {
  if (!to) {
    return { sent: false, reason: 'missing_recipient' }
  }

  const resendKey = process.env.RESEND_API_KEY
  const mailFrom = process.env.MAIL_FROM

  if (!resendKey || !mailFrom) {
    console.info(`[${logLabel}] dry-run to=${to} subject="${subject}"`)
    return { sent: false, reason: 'email_not_configured', dryRun: true }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mailFrom,
      to,
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend failed (${response.status}): ${body}`)
  }

  return { sent: true }
}

import Anthropic from '@anthropic-ai/sdk'
import { buildTemplateNotificationCopy } from '../utils/proactiveNotificationRules.js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function parseJsonResponse(rawText) {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()

  return JSON.parse(cleaned)
}

/*
 * generateProactiveNotificationCopy(trigger)
 *
 * Claude writes a short title + body for a trigger that already fired in code.
 * Falls back to deterministic templates if the API fails.
 */
export async function generateProactiveNotificationCopy(trigger) {
  const fallback = buildTemplateNotificationCopy(trigger)

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallback
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 180,
      system: `You write short proactive finance alerts for Soverm. Respond ONLY with JSON: {"title":"...","body":"..."}.
Title: max 8 words. Body: 1-2 sentences, max 40 words total.
Use ONLY the facts provided — never invent merchants, amounts, or categories.
Tone: direct, calm, helpful — not alarmist.`,
      messages: [
        {
          role: 'user',
          content: `Write a notification for trigger type "${trigger.triggerType}" using these facts:\n${JSON.stringify(trigger.facts, null, 2)}`,
        },
      ],
    })

    const rawText = response.content[0]?.text
    if (!rawText) {
      return fallback
    }

    const parsed = parseJsonResponse(rawText)

    if (!parsed.title?.trim() || !parsed.body?.trim()) {
      return fallback
    }

    return {
      title: parsed.title.trim(),
      body: parsed.body.trim(),
    }
  } catch (err) {
    console.error('Proactive notification copy failed, using template:', err.message)
    return fallback
  }
}

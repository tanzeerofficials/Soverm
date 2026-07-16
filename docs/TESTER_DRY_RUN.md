# Next-week tester dry-run

Hand this to real-user testers (or run it yourself before invites). Goal: they feel “this understands my paycheck week” — calm home, honest cancel language, helpful chat, billing that doesn’t break trust.

**Deploy first:** ship **client (Vercel) + API (Railway) together** so Overview/chat/billing UI match the API.

---

## Five steps (core loop)

1. **Connect one bank**, confirm payday (Overview setup / Weekly payday if prompted).
2. Open **Your week** — read what’s left until payday.
3. On a subscription flag, tap **Plan to cancel** — confirm copy says Soverm reminds you; it does **not** cancel with the merchant. Follow-ups should read like “Reminder: cancel Netflix yourself.”
4. **Ask Soverm** about that bill from the same page — chat should open with that charge in context (and a short “Using this week’s review…” label).
5. *(Optional)* Hit the free insight limit / see a Pro CTA if you want monetization feedback. If testing Pro: Upgrade → Settings shows Pro → Manage billing → cancel → Free again within ~30s.

If those five feel calm and trustworthy, the MVP is ready for real feedback.

---

## Stripe launch gate (ops, ~15 min)

See README → **Stripe (Soverm Pro) → Production setup checklist**. Short version:

- Railway: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL=https://soverm.vercel.app`
- Migration **019** applied on prod DB
- Webhook → `https://soverm-production.up.railway.app/webhooks/stripe` (3 events)
- Customer Portal cancel enabled
- Smoke: Free → Upgrade → Pro → Manage billing → cancel (portal cancel is usually *at period end* — Settings stays Pro until then; use Stripe “Cancel immediately” to verify Free within ~30s)

/*
 * PRIVACY POLICY
 *
 * Keep the "What account deletion removes" and "Analytics" sections in sync with
 * server/utils/deleteUserData.js and client/src/lib/analytics.js.
 */

import { LegalDocumentPage, Section } from '../components/LegalDocumentPage.jsx'

function PrivacyPage() {
  return (
    <LegalDocumentPage title="Privacy Policy">
      <Section title="Who we are">
        <p>
          Soverm (&quot;we&quot;, &quot;us&quot;) provides an AI-assisted personal finance
          dashboard. This policy explains what data we collect, how we use it, and your choices.
          Contact:{' '}
          <a className="text-brand-soft hover:underline" href="mailto:privacy@soverm.com">
            privacy@soverm.com
          </a>
          .
        </p>
      </Section>

      <Section title="Information we collect">
        <p>
          <strong className="text-fg">Account information.</strong> When you sign up with Clerk, we
          store your user id, email address, and display name so we can authenticate you and
          associate bank data with your account.
        </p>
        <p>
          <strong className="text-fg">Financial data via Plaid.</strong> If you connect a bank, Plaid
          provides account balances, account metadata, and transaction history. We store that data
          in our database to power your dashboard, insights, expense analysis, trackers, and chat.
          We do not receive or store your bank login credentials — those stay with Plaid.
        </p>
        <p>
          <strong className="text-fg">AI-generated content.</strong> Insights, chat replies, and
          optional expense narratives are generated using Anthropic&apos;s Claude API. Relevant
          financial context (balances, transactions, categories) is sent to Anthropic to produce
          those responses and may be retained according to Anthropic&apos;s policies.
        </p>
        <p>
          <strong className="text-fg">Usage and preferences.</strong> We store subscription tier,
          notification preferences, trackers/goals you create, and in-app notification history.
        </p>
      </Section>

      <Section title="How we use information">
        <p>
          We use your data to sync accounts, show balances and spending, generate insights and chat
          answers, detect recurring charges and savings transfers, send in-app alerts, enforce free
          and Pro plan limits, and improve reliability (including optional error monitoring).
        </p>
      </Section>

      <Section title="Analytics">
        <p>
          If enabled, we use PostHog for product analytics (for example: page views, connect bank,
          upgrade clicks, weekly review / month letter views, and activation checklist steps). We do
          not send balances, transaction lists, or chat message contents to PostHog. You can ask us
          to disable analytics for your account by contacting privacy@soverm.com.
        </p>
      </Section>

      <Section title="Error monitoring">
        <p>
          If Sentry is configured, we may send technical error reports (stack traces, request paths)
          to help fix bugs. We scrub sensitive fields before sending where possible.
        </p>
      </Section>

      <Section title="Sharing">
        <p>
          We share data with service providers who help us operate Soverm: Clerk (authentication),
          Plaid (bank connections), Anthropic (AI), our hosting providers (e.g. Vercel, Railway /
          Postgres), and optionally PostHog and Sentry. We do not sell your personal information.
        </p>
      </Section>

      <Section title="What account deletion removes">
        <p>
          When you delete your account from Profile, we permanently remove your Soverm data,
          including: chat messages, insight action items, insights, transactions, connected
          accounts, Plaid item records, and your user profile. We also attempt to revoke linked
          Plaid Items and cancel any active Soverm Pro Stripe subscription so billing stops.
          Some records may remain briefly in encrypted backups until those backups rotate.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          We keep your data while your account is active. Free-tier history visibility may be
          limited in the product UI, but deletion is controlled by you via account deletion.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can disconnect banks, turn off proactive alerts, delete your account, or contact us to
          ask questions about your data. For Plaid-related rights, you may also review Plaid&apos;s
          privacy policy.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update this policy. We will revise the effective date above when we do. Continued
          use of Soverm after changes means you accept the updated policy.
        </p>
      </Section>
    </LegalDocumentPage>
  )
}

export default PrivacyPage

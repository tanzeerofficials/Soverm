/*
 * TERMS OF SERVICE
 */

import { Link } from 'react-router-dom'
import { LegalDocumentPage, Section } from '../components/LegalDocumentPage.jsx'
import { PRO_MONTHLY_PRICE } from '@shared/usageLimits.js'

function TermsPage() {
  return (
    <LegalDocumentPage title="Terms of Service">
      <Section title="Agreement">
        <p>
          By using Soverm you agree to these Terms and our{' '}
          <Link className="text-brand-soft hover:underline" to="/privacy">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the service. Contact:{' '}
          <a className="text-brand-soft hover:underline" href="mailto:support@soverm.com">
            support@soverm.com
          </a>
          .
        </p>
      </Section>

      <Section title="What Soverm is (and is not)">
        <p>
          Soverm is a personal finance information tool. It is <strong className="text-fg">not</strong>{' '}
          a bank, broker, tax advisor, or fiduciary. Insights, forecasts, and chat answers are
          informational estimates based on connected-account data and AI models. They can be wrong
          or incomplete. You remain responsible for your financial decisions.
        </p>
      </Section>

      <Section title="Accounts and eligibility">
        <p>
          You must provide accurate account information and keep your login secure. You must be
          legally able to enter this agreement in your jurisdiction. Bank linking is currently
          supported for eligible U.S. institutions via Plaid.
        </p>
      </Section>

      <Section title="Bank connections">
        <p>
          Bank connections are provided through Plaid. By linking an account you authorize us to
          retrieve and store balances and transactions for the features you use. You can disconnect
          accounts at any time in Settings.
        </p>
      </Section>

      <Section title="Plans and billing">
        <p>
          Soverm offers a Free plan with limited daily insights and history, and Soverm Pro for $
          {PRO_MONTHLY_PRICE}/month with higher limits as described on our pricing page. Paid
          subscriptions are processed by Stripe. Fees are billed in advance; taxes may apply.
          Cancel anytime; access continues through the end of the current billing period unless
          otherwise stated at checkout.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Do not misuse the service (for example: attempt to access others&apos; data, abuse AI
          endpoints, reverse engineer beyond what the law allows, or use Soverm for unlawful
          activity). We may suspend or terminate accounts that violate these Terms.
        </p>
      </Section>

      <Section title="Intellectual property">
        <p>
          Soverm&apos;s software, branding, and UI are owned by us or our licensors. You retain
          rights to your own financial data. You grant us a limited license to process that data to
          provide the service.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. We do not warrant uninterrupted or error-free operation, or that
          insights will meet your expectations.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, Soverm and its providers are not liable for
          indirect, incidental, special, consequential, or punitive damages, or for lost profits or
          data, arising from your use of the service. Our aggregate liability for claims relating to
          the service is limited to the greater of (a) amounts you paid us in the 12 months before
          the claim or (b) $50.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You may delete your account at any time. We may suspend or terminate access if you breach
          these Terms or if we discontinue the service. Upon deletion, we remove data as described
          in the Privacy Policy.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these Terms and will update the effective date when we do. Continued use
          after changes constitutes acceptance.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These Terms are governed by the laws of the State of Delaware, USA, without regard to
          conflict-of-law rules, except where mandatory consumer protections in your place of
          residence apply.
        </p>
      </Section>
    </LegalDocumentPage>
  )
}

export default TermsPage

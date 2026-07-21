/*
 * Clerk modal appearance — match Soverm’s dark marketing surface.
 *
 * Canonical brand spelling is **Soverm** (UI “SOVERM”, titles “Soverm”).
 * The application name shown in Clerk modals (“Sign in to …”) comes from the
 * Clerk Dashboard → Configure → Application → Application name. Set that to
 * “Soverm” so it matches the site (not “Sovrm” / “Sovrn”).
 */

import { dark } from '@clerk/themes'

export const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#10b981',
    colorBackground: '#0A0F1C',
    colorInputBackground: '#1a2236',
    colorInputText: '#EEF0F4',
    colorText: '#EEF0F4',
    colorTextSecondary: '#9CA3AF',
    colorNeutral: '#1e2d45',
    borderRadius: '0.75rem',
  },
  elements: {
    card: 'shadow-xl border border-[#1e2d45]',
    headerTitle: 'text-[#EEF0F4]',
    headerSubtitle: 'text-[#9CA3AF]',
    socialButtonsBlockButton:
      'border border-[#1e2d45] bg-[#1a2236] text-[#EEF0F4] hover:bg-[#243049]',
    formButtonPrimary: 'bg-[#10b981] hover:bg-[#34d399] text-[#0A0F1C]',
    footerActionLink: 'text-[#10b981] hover:text-[#34d399]',
  },
}

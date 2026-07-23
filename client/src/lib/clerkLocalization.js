/*
 * Clerk copy overrides — keep OAuth buttons explicit.
 *
 * Why: with Google + Apple both enabled, Clerk switches to
 * socialButtonsBlockButtonManyInView which only shows the provider name
 * ("Google", "Apple"). That reads as vague on a finance sign-in modal.
 * We keep the full "Continue with …" phrasing in every layout.
 */

export const clerkLocalization = {
  socialButtonsBlockButton: 'Continue with {{provider|titleize}}',
  socialButtonsBlockButtonManyInView: 'Continue with {{provider|titleize}}',
  dividerText: 'or continue with email',
}

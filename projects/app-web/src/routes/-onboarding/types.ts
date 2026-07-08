/**
 * The onboarding form's non-redirect outcome. A successful account creation ends in a thrown
 * redirect home instead of a value here.
 */
export interface OnboardingResult {
  readonly fieldErrors: Readonly<
    Partial<Record<'agreeToTerms' | 'confirmPassword' | 'name' | 'password' | 'username', string>>
  >;
  readonly status: 'invalid-fields';
}

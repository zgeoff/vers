/**
 * The signup form's non-redirect outcome. A caller with no existing account ends in a thrown
 * redirect to verify-otp instead of a value here.
 */
export interface SignupResult {
  readonly fieldErrors: Readonly<Partial<Record<'email', string>>>;
  readonly status: 'invalid-fields';
}

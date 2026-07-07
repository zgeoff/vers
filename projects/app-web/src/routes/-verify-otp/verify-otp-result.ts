/**
 * The verify-otp form's non-redirect outcome. Every successful verify ends in a thrown redirect
 * instead of a value here — its continuation depends on the verification type.
 */
export interface VerifyOTPResult {
  readonly formError: string;
  readonly status: 'invalid-fields';
}

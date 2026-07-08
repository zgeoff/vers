/** What a verification type's post-verify continuation needs: who/what it verified for. */
export interface RunVerificationContext {
  readonly redirectTo?: string | undefined;
  readonly target: string;
}

/**
 * The verify-otp form's non-redirect outcome. Every successful verify ends in a thrown redirect
 * instead of a value here — its continuation depends on the verification type.
 */
export interface VerifyOTPResult {
  readonly formError: string;
  readonly status: 'invalid-fields';
}

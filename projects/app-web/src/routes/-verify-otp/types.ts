/** What a verification type's post-verify continuation needs: who/what it verified for. */
export interface RunVerificationContext {
  readonly redirectTo?: string | undefined;
  readonly target: string;
}

/**
 * The verify-otp form's outcomes. Every verification type but `change-email` ends a successful
 * verify in a thrown redirect instead of a value here; `change-email` reports
 * `'change-email-applied'` so its caller can refresh the account hub without one.
 */
export type VerifyOTPResult =
  | { readonly formError: string; readonly status: 'invalid-fields' }
  | { readonly status: 'change-email-applied' };

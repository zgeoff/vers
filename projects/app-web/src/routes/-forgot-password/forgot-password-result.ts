/**
 * The forgot-password form's non-redirect outcome. Every submission that clears validation ends
 * in a thrown redirect to reset-password-started instead of a value here, whether or not the
 * email matches an account — the page never reveals which.
 */
export interface ForgotPasswordResult {
  readonly fieldErrors: Readonly<Partial<Record<'email', string>>>;
  readonly status: 'invalid-fields';
}

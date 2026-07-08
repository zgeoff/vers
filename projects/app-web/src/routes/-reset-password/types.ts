/**
 * The reset-password form's non-redirect outcome. A successful reset ends in a thrown redirect to
 * login instead of a value here.
 */
export interface ResetPasswordResult {
  readonly fieldErrors: Readonly<Partial<Record<'confirmPassword' | 'password', string>>>;
  readonly formError?: string;
  readonly status: 'invalid-fields';
}

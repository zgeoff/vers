/**
 * The 2FA-setup verify form's non-redirect outcome. A successful verify ends the request in a
 * thrown redirect to `/account` instead of a value here.
 */
export interface VerifyTwoFactorSetupResult {
  readonly formError: string;
  readonly status: 'invalid-fields';
}

/**
 * The disable-2FA action's non-redirect outcomes. A cleared step-up gate ends the request in a
 * thrown redirect back to `/account` instead of a value here.
 */
export type DisableTwoFactorAuthResult =
  | { readonly formError: string; readonly status: 'error' }
  | {
      readonly status: 'step-up-required';
      readonly target: string;
      readonly transactionID: string;
    };

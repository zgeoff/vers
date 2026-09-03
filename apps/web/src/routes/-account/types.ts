export type DisableTwoFactorAuthResult =
  | { readonly formError: string; readonly status: 'error' }
  | {
      readonly status: 'step-up-required';
      readonly target: string;
      readonly transactionID: string;
    };

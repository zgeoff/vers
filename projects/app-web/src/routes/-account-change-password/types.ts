type ChangePasswordFieldErrors = Readonly<
  Partial<Record<'confirmPassword' | 'currentPassword' | 'password', string>>
>;

/**
 * The change-password form's non-redirect outcomes. A cleared step-up gate followed by a
 * successful password change ends the request in a thrown redirect to `/account` instead of a
 * value here.
 */
export type ChangePasswordResult =
  | { readonly fieldErrors: ChangePasswordFieldErrors; readonly status: 'invalid-fields' }
  | { readonly formError: string; readonly status: 'invalid-credentials' }
  | {
      readonly status: 'step-up-required';
      readonly target: string;
      readonly transactionID: string;
    };

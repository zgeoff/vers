type ChangePasswordFieldErrors = Readonly<
  Partial<Record<'confirmPassword' | 'currentPassword' | 'password', string>>
>;

export type ChangePasswordResult =
  | { readonly fieldErrors: ChangePasswordFieldErrors; readonly status: 'invalid-fields' }
  | { readonly formError: string; readonly status: 'invalid-credentials' }
  | {
      readonly status: 'step-up-required';
      readonly target: string;
      readonly transactionID: string;
    };

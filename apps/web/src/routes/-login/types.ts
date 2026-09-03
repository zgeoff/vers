export type LoginResult =
  | { readonly status: 'invalid-credentials' }
  | {
      readonly fieldErrors: Readonly<Partial<Record<'email' | 'password', string>>>;
      readonly status: 'invalid-fields';
    };

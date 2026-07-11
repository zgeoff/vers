/**
 * The login form's non-redirect outcomes. Every other outcome (2FA required, a concurrent-session
 * force logout, or a clean success) ends the request in a thrown redirect instead of a value here.
 */
export type LoginResult =
  | { readonly status: 'invalid-credentials' }
  | {
      readonly fieldErrors: Readonly<Partial<Record<'email' | 'password', string>>>;
      readonly status: 'invalid-fields';
    };

/**
 * The change-email form's non-redirect outcomes. A cleared step-up gate ends the request in a
 * thrown redirect to verify-otp instead of a value here — ownership of the new address still
 * needs to be confirmed there before it's applied.
 */
export type ChangeEmailResult =
  | {
      readonly fieldErrors: Readonly<Partial<Record<'email', string>>>;
      readonly status: 'invalid-fields';
    }
  | {
      readonly status: 'step-up-required';
      readonly target: string;
      readonly transactionID: string;
    };

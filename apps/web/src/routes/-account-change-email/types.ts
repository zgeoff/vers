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

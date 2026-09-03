export type VerificationKind = 'change-email' | 'reset-password' | 'two-factor' | 'welcome';

export type VerificationKindOption = VerificationKind | 'any';

export interface EmailContent {
  readonly html: string;
  readonly text: string;
}

export interface Verification {
  readonly code: string | null;
  readonly kind: VerificationKind;
  readonly url: string | null;
}

export interface ReceivedEmailSummary {
  readonly createdAt: string;
  readonly from: string;
  readonly id: string;
  readonly subject: string;
  readonly to: ReadonlyArray<string>;
}

export interface ReceivedEmail extends ReceivedEmailSummary {
  readonly html: string;
  readonly text: string;
}

export interface ReceivedVerification extends Verification {
  readonly id: string;
  readonly receivedAt: string;
  readonly subject: string;
}

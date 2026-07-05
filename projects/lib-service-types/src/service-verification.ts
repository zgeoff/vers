import type * as schema from '@vers/postgres-schema';

export type VerificationType = (typeof schema.verifications.$inferSelect)['type'];

interface VerificationData {
  id: string;
  target: string;
  type: VerificationType;
}

export type CreateVerificationPayload = VerificationData & { otp: string };

export type VerifyCodePayload = null | VerificationData;

export type GetVerificationPayload = null | VerificationData;

export interface UpdateVerificationPayload {
  updatedID: string;
}

export interface DeleteVerificationPayload {
  deletedID: string;
}

export interface Get2FAVerificationURIPayload {
  otpURI: string;
}

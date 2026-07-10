import { publicRoute } from '@vers/contract-base';
import * as z from 'zod';
import { VerificationDataSchema } from './verification-data-schema';
import { VerificationTypeSchema } from './verification-type-schema';

/**
 * The verification service's API: TOTP-backed codes for 2FA, email change, and onboarding.
 */
export const verificationContract = {
  createVerification: publicRoute
    .route({ method: 'POST', path: '/verifications', summary: 'Create a verification code' })
    .input(
      z.object({
        expiresAt: z.coerce.date().nullable().optional(),
        period: z.int().optional(),
        target: z.string(),
        type: VerificationTypeSchema,
      }),
    )
    .output(VerificationDataSchema.extend({ otp: z.string() })),

  deleteVerification: publicRoute
    .route({ method: 'DELETE', path: '/verifications/{id}', summary: 'Delete a verification' })
    .input(z.object({ id: z.string() }))
    .output(z.object({ deletedID: z.string() }))
    .errors({
      NOT_FOUND: { data: z.object({}), message: 'Verification not found' },
    }),

  get2FAVerificationURI: publicRoute
    .route({
      method: 'GET',
      path: '/verifications/2fa-uri',
      summary: 'Get the TOTP auth URI for a pending 2FA setup',
    })
    .input(z.object({ target: z.string() }))
    .output(z.object({ otpURI: z.string() }))
    .errors({
      NOT_FOUND: { data: z.object({}), message: 'No 2FA verification found for this target' },
    }),

  getVerification: publicRoute
    .route({ method: 'GET', path: '/verifications', summary: 'Look up a verification' })
    .input(z.object({ target: z.string(), type: VerificationTypeSchema }))
    .output(VerificationDataSchema.nullable()),

  updateVerification: publicRoute
    .route({ method: 'PATCH', path: '/verifications/{id}', summary: 'Update a verification' })
    .input(z.object({ id: z.string(), type: VerificationTypeSchema.optional() }))
    .output(z.object({ updatedID: z.string() }))
    .errors({
      NOT_FOUND: { data: z.object({}), message: 'Verification not found' },
    }),

  verifyCode: publicRoute
    .route({ method: 'POST', path: '/verifications/verify', summary: 'Verify a code' })
    .input(z.object({ code: z.string(), target: z.string(), type: VerificationTypeSchema }))
    .output(VerificationDataSchema)
    .errors({
      CODE_ALREADY_USED: { data: z.object({}), message: 'Verification code has already been used' },
      CODE_EXPIRED: { data: z.object({}), message: 'Verification code has expired' },
      INVALID_CODE: { data: z.object({}), message: 'Invalid verification code' },
    }),
};

export type VerificationContract = typeof verificationContract;

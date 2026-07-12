import { publicRoute } from '@vers/contract-base';
import { EmailJobOutputSchema } from './email-job-output-schema';
import { SendChangeEmailNotificationInputSchema } from './send-change-email-notification-input-schema';
import { SendChangeEmailVerificationInputSchema } from './send-change-email-verification-input-schema';
import { SendExistingAccountInputSchema } from './send-existing-account-input-schema';
import { SendPasswordChangedInputSchema } from './send-password-changed-input-schema';
import { SendResetPasswordInputSchema } from './send-reset-password-input-schema';
import { SendWelcomeInputSchema } from './send-welcome-input-schema';

/**
 * The email service's API: one procedure per transactional template, each enqueuing a delivery job
 * and returning its id rather than sending inline.
 */
export const emailContract = {
  sendChangeEmailNotification: publicRoute
    .route({
      method: 'POST',
      path: '/emails/change-email-notification',
      summary: 'Enqueue a change-email notification email',
    })
    .input(SendChangeEmailNotificationInputSchema)
    .output(EmailJobOutputSchema),

  sendChangeEmailVerification: publicRoute
    .route({
      method: 'POST',
      path: '/emails/change-email-verification',
      summary: 'Enqueue a change-email verification email',
    })
    .input(SendChangeEmailVerificationInputSchema)
    .output(EmailJobOutputSchema),

  sendExistingAccount: publicRoute
    .route({
      method: 'POST',
      path: '/emails/existing-account',
      summary: 'Enqueue an existing-account signup email',
    })
    .input(SendExistingAccountInputSchema)
    .output(EmailJobOutputSchema),

  sendPasswordChanged: publicRoute
    .route({
      method: 'POST',
      path: '/emails/password-changed',
      summary: 'Enqueue a password-changed notification email',
    })
    .input(SendPasswordChangedInputSchema)
    .output(EmailJobOutputSchema),

  sendResetPassword: publicRoute
    .route({
      method: 'POST',
      path: '/emails/reset-password',
      summary: 'Enqueue a reset-password email',
    })
    .input(SendResetPasswordInputSchema)
    .output(EmailJobOutputSchema),

  /**
   * Despite the name, this template carries the signup onboarding OTP: `verificationCode` and
   * `verificationURL` are the props it renders, not a distinct "welcome" payload.
   */
  sendWelcome: publicRoute
    .route({
      method: 'POST',
      path: '/emails/welcome',
      summary: 'Enqueue a welcome/onboarding email',
    })
    .input(SendWelcomeInputSchema)
    .output(EmailJobOutputSchema),
};

export type EmailContract = typeof emailContract;

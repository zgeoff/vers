import {
  SendChangeEmailNotificationInputSchema,
  SendChangeEmailVerificationInputSchema,
  SendExistingAccountInputSchema,
  SendPasswordChangedInputSchema,
  SendResetPasswordInputSchema,
  SendWelcomeInputSchema,
} from '@vers/contract-email';
import type { EmailClient } from '@vers/email';
import {
  generateChangeEmailNotificationEmail,
  generateChangeEmailVerificationEmail,
  generateExistingAccountEmail,
  generatePasswordChangedEmail,
  generateResetPasswordEmail,
  generateWelcomeEmail,
} from '@vers/email';
import type { JobQueue } from '@vers/jobs';
import { createJobQueue, defineJobs } from '@vers/jobs';

/**
 * Every job shares the same retry posture: five attempts on an exponential backoff off a 30 second
 * base, dead-lettering a delivery that never succeeds instead of dropping it silently.
 */
const RETRY_POLICY = {
  deadLetter: true,
  retryBackoff: true,
  retryDelay: 30,
  retryLimit: 5,
} as const;

const EMAIL_JOB_DEFS = defineJobs({
  'send-change-email-notification': {
    ...RETRY_POLICY,
    schema: SendChangeEmailNotificationInputSchema,
  },
  'send-change-email-verification': {
    ...RETRY_POLICY,
    schema: SendChangeEmailVerificationInputSchema,
  },
  'send-existing-account': { ...RETRY_POLICY, schema: SendExistingAccountInputSchema },
  'send-password-changed': { ...RETRY_POLICY, schema: SendPasswordChangedInputSchema },
  'send-reset-password': { ...RETRY_POLICY, schema: SendResetPasswordInputSchema },
  'send-welcome': { ...RETRY_POLICY, schema: SendWelcomeInputSchema },
});

export type EmailJobDefs = typeof EMAIL_JOB_DEFS;

export interface CreateEmailJobQueueConfig {
  readonly connectionString: string;
  readonly emailClient: EmailClient;

  /**
   * Called for every pg-boss maintenance/connection fault; defaults to `@vers/jobs`'s own
   * `console.error` fallback when omitted.
   */
  readonly onError?: (error: Error) => void;
}

/**
 * Builds the queue behind every send procedure: one job per template, each rendering its matching
 * `@vers/email` generator and delivering through the shared `EmailClient`, keyed on its own
 * pg-boss job id so a retried delivery can never double-send.
 */
export function createEmailJobQueue(
  config: Readonly<CreateEmailJobQueueConfig>,
): JobQueue<EmailJobDefs> {
  const emailClient = config.emailClient;

  // Passed as an object literal, not a separately-typed variable: `createJobQueue`'s handler map
  // is a type inferred jointly with the queue defs argument, and TypeScript only carries that
  // per-job payload typing through when the literal is contextually typed at the call site.
  return createJobQueue(EMAIL_JOB_DEFS, {
    connectionString: config.connectionString,
    handlers: {
      'send-change-email-notification': async (payload, context) => {
        const email = await generateChangeEmailNotificationEmail();

        await emailClient.sendEmail({
          ...email,
          idempotencyKey: context.jobID,
          subject: 'Your vers email address was changed',
          to: payload.to,
        });
      },
      'send-change-email-verification': async (payload, context) => {
        const email = await generateChangeEmailVerificationEmail({
          newEmail: payload.newEmail,
          verificationCode: payload.verificationCode,
          verificationURL: payload.verificationURL,
        });

        await emailClient.sendEmail({
          ...email,
          idempotencyKey: context.jobID,
          subject: 'Verify your new vers email address',
          to: payload.to,
        });
      },
      'send-existing-account': async (payload, context) => {
        const email = await generateExistingAccountEmail({ email: payload.email });

        await emailClient.sendEmail({
          ...email,
          idempotencyKey: context.jobID,
          subject: 'You already have a vers account',
          to: payload.to,
        });
      },
      'send-password-changed': async (payload, context) => {
        const email = await generatePasswordChangedEmail({ email: payload.email });

        await emailClient.sendEmail({
          ...email,
          idempotencyKey: context.jobID,
          subject: 'Your vers password was changed',
          to: payload.to,
        });
      },
      'send-reset-password': async (payload, context) => {
        const email = await generateResetPasswordEmail({ resetURL: payload.resetURL });

        await emailClient.sendEmail({
          ...email,
          idempotencyKey: context.jobID,
          subject: 'Reset your vers password',
          to: payload.to,
        });
      },
      'send-welcome': async (payload, context) => {
        const email = await generateWelcomeEmail({
          verificationCode: payload.verificationCode,
          verificationURL: payload.verificationURL,
        });

        await emailClient.sendEmail({
          ...email,
          idempotencyKey: context.jobID,
          subject: 'Welcome to vers — verify your account',
          to: payload.to,
        });
      },
    },
    ...(config.onError !== undefined && { onError: config.onError }),
  });
}

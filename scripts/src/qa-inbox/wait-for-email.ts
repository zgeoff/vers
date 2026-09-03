import pRetry from 'p-retry';
import { collectMatchingEmails } from './collect-matching-emails';
import { findVerification } from './find-verification';
import { readReceivedEmail } from './read-received-email';
import { readReceivedEmails } from './read-received-emails';
import { ResendRequestError } from './resend-request-error';
import type { ReceivedVerification, VerificationKindOption } from './types';

const LIST_LIMIT = 100;
const POLL_INTERVAL_MS = 3000;

interface WaitForEmailConfig {
  readonly apiKey: string;
  readonly kind: VerificationKindOption;
  readonly since: Date;
  readonly timeoutMS: number;
  readonly to: string;
}

export function waitForEmail(config: WaitForEmailConfig): Promise<ReceivedVerification> {
  const skipped = new Set<string>();

  return pRetry(
    async () => {
      const listed = await readReceivedEmails(config.apiKey, { limit: LIST_LIMIT });

      for (const summary of collectMatchingEmails(listed, {
        since: config.since,
        to: config.to,
      })) {
        if (skipped.has(summary.id)) {
          continue;
        }

        const email = await readReceivedEmail(config.apiKey, summary.id);

        const verification = findVerification(email, config.kind);

        if (verification !== null) {
          return {
            ...verification,
            id: email.id,
            receivedAt: email.createdAt,
            subject: email.subject,
          };
        }

        skipped.add(summary.id);
      }

      throw new Error(
        `no ${formatKind(config.kind)} for ${config.to} since ${config.since.toISOString()}`,
      );
    },
    {
      factor: 1,
      maxRetryTime: config.timeoutMS,
      minTimeout: POLL_INTERVAL_MS,
      retries: Math.ceil(config.timeoutMS / POLL_INTERVAL_MS),
      shouldRetry: (context) => !isFatalResendError(context.error),
    },
  );
}

function formatKind(kind: VerificationKindOption): string {
  return kind === 'any' ? 'verification email' : `${kind} email`;
}

function isFatalResendError(error: Error): boolean {
  return error instanceof ResendRequestError && error.status < 500 && error.status !== 429;
}

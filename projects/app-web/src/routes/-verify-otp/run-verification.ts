import type { VerificationType } from '@vers/contract-verification';
import { run2FA } from './run-2fa';
import { runChangeEmail } from './run-change-email';
import { runOnboarding } from './run-onboarding';
import { runUnsupported } from './run-unsupported';
import type { RunVerificationContext } from './types';

type VerificationHandler = (ctx: Readonly<RunVerificationContext>) => Promise<void>;

const RUN_VERIFICATION_TYPE_STRATEGY: Record<VerificationType, VerificationHandler> = {
  '2fa': run2FA,
  '2fa-setup': runUnsupported,
  'change-email': runChangeEmail,
  onboarding: runOnboarding,
};

/**
 * Runs a verification type's post-verify continuation. Every type but `change-email` ends its own
 * handler in a thrown redirect; `change-email` applies its mutation and returns instead, so its
 * caller can report success without relying on a server-issued redirect.
 */
export function runVerification(
  type: VerificationType,
  ctx: Readonly<RunVerificationContext>,
): Promise<void> {
  return RUN_VERIFICATION_TYPE_STRATEGY[type](ctx);
}

import type { VerificationType } from '@vers/contract-verification';
import { run2FA } from './run-2fa';
import { runChangeEmail } from './run-change-email';
import { runOnboarding } from './run-onboarding';
import { runUnsupported } from './run-unsupported';
import type { RunVerificationContext } from './run-verification-context';

type VerificationHandler = (ctx: Readonly<RunVerificationContext>) => Promise<never>;

const RUN_VERIFICATION_TYPE_STRATEGY: Record<VerificationType, VerificationHandler> = {
  '2fa': run2FA,
  '2fa-setup': runUnsupported,
  'change-email': runChangeEmail,
  onboarding: runOnboarding,
};

/** Runs a verification type's post-verify continuation: a redirect target and session mutation. */
export function runVerification(
  type: VerificationType,
  ctx: Readonly<RunVerificationContext>,
): Promise<never> {
  return RUN_VERIFICATION_TYPE_STRATEGY[type](ctx);
}

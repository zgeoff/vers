import type { VerificationType } from '@vers/contract-verification';
import { handle2FA } from './handle-2fa';
import { handleChangeEmail } from './handle-change-email';
import { handleOnboarding } from './handle-onboarding';
import { handleUnsupported } from './handle-unsupported';
import type { HandleVerificationContext } from './handle-verification-context';

type VerificationHandler = (ctx: Readonly<HandleVerificationContext>) => Promise<never>;

const HANDLE_VERIFICATION_TYPE_STRATEGY: Record<VerificationType, VerificationHandler> = {
  '2fa': handle2FA,
  '2fa-setup': handleUnsupported,
  'change-email': handleChangeEmail,
  onboarding: handleOnboarding,
};

/** Runs a verification type's post-verify continuation: a redirect target and session mutation. */
export function handleVerification(
  type: VerificationType,
  ctx: Readonly<HandleVerificationContext>,
): Promise<never> {
  return HANDLE_VERIFICATION_TYPE_STRATEGY[type](ctx);
}

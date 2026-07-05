import { VerificationType } from '../../gql/graphql';
import { handle2FADisable } from './handle-2fa-disable.server';
import { handle2FA } from './handle-2fa.server';
import { handleChangeEmailConfirmation } from './handle-change-email-confirmation.server';
import { handleChangeEmail } from './handle-change-email.server';
import { handleChangePassword } from './handle-change-password.server';
import { handleOnboarding } from './handle-onboarding.server';
import { handleResetPassword } from './handle-reset-password.server';
import { handleUnsupported } from './handle-unsupported.server';
import type { HandleVerificationContext } from './types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function handleVerification(type: VerificationType, context: HandleVerificationContext) {
  const strategy = HANDLE_VERIFICATION_TYPE_STRATEGY[type];

  return strategy(context);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
type VerificationHandlerStrategy = (ctx: HandleVerificationContext) => Promise<Response>;

type StrategyMap = Record<VerificationType, VerificationHandlerStrategy>;

const HANDLE_VERIFICATION_TYPE_STRATEGY: StrategyMap = {
  [VerificationType.ChangeEmail]: handleChangeEmail,
  [VerificationType.ChangeEmailConfirmation]: handleChangeEmailConfirmation,
  [VerificationType.ChangePassword]: handleChangePassword,
  [VerificationType.Onboarding]: handleOnboarding,
  [VerificationType.ResetPassword]: handleResetPassword,
  [VerificationType.TwoFactorAuth]: handle2FA,
  [VerificationType.TwoFactorAuthDisable]: handle2FADisable,
  [VerificationType.TwoFactorAuthSetup]: handleUnsupported,
};

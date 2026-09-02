import { redirect } from '@tanstack/react-router';
import { checkStepUp } from '../../lib/auth/check-step-up';
import { findStepUpToken } from '../../lib/auth/find-step-up-token';
import { requireAuth } from '../../lib/auth/require-auth';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import type { DisableTwoFactorAuthResult } from './types';

export async function runDisableTwoFactorAuth(
  formData: FormData,
): Promise<DisableTwoFactorAuthResult> {
  await requireAuth();

  const user = await userClient.getCurrentUser({});

  const stepUp = await checkStepUp({
    action: 'TwoFactorAuthDisable',
    target: user.id,
    token: findStepUpToken(formData),
  });

  if (stepUp.status === 'required') {
    return { status: 'step-up-required', target: user.id, transactionID: stepUp.transactionID };
  }

  const twoFactorVerification = await verificationClient.getVerification({
    target: user.id,
    type: '2fa',
  });

  if (twoFactorVerification === null) {
    return { formError: 'Two-factor authentication is not enabled', status: 'error' };
  }

  await verificationClient.deleteVerification({ id: twoFactorVerification.id });

  throw redirect({ href: '/account' });
}

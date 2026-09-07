import { isDefinedError, safe } from '@orpc/client';
import { redirect } from '@tanstack/react-router';
import { requireAuth } from '../../lib/auth/require-auth';
import { verificationClient } from '../../lib/rpc/clients/verification-client';
import { logger } from '../../server/logger';
import type { VerifyTwoFactorSetupResult } from './types';
import { VerifyTwoFactorSetupFormSchema } from './verify-two-factor-setup-form-schema';

export async function verifyTwoFactorSetupHandler(
  formData: FormData,
): Promise<VerifyTwoFactorSetupResult> {
  await requireAuth();

  const submission = VerifyTwoFactorSetupFormSchema.safeParse({
    code: formData.get('code'),
    target: formData.get('target'),
  });

  if (!submission.success) {
    return { formError: 'Invalid code', status: 'invalid-fields' };
  }

  const [error, verification] = await safe(
    verificationClient.verifyCode({
      code: submission.data.code,
      target: submission.data.target,
      type: '2fa-setup',
    }),
  );

  if (error) {
    if (!isDefinedError(error)) {
      logger.error({ err: error }, 'two-factor setup verification failed');
    }

    return { formError: 'Invalid or expired code', status: 'invalid-fields' };
  }

  await verificationClient.updateVerification({ id: verification.id, type: '2fa' });

  throw redirect({ to: '/settings' });
}

import { redirect } from '@tanstack/react-router';
import { toDataURL } from 'qrcode';
import { requireAuth } from '../../lib/auth/require-auth';
import { withRequiredSession } from '../../lib/auth/with-required-session';
import { userClient } from '../../lib/rpc/clients/user-client';
import { verificationClient } from '../../lib/rpc/clients/verification-client';

export interface TwoFactorSetupData {
  readonly otpURI: string;
  readonly qrCodeDataURL: string;
  readonly target: string;
}

export async function loadTwoFactorSetup(): Promise<TwoFactorSetupData> {
  await requireAuth();

  return withRequiredSession(async () => {
    const user = await userClient.getCurrentUser({});

    const twoFactorVerification = await verificationClient.getVerification({
      target: user.id,
      type: '2fa',
    });

    if (twoFactorVerification !== null) {
      throw redirect({ href: '/account' });
    }

    const existingSetup = await verificationClient.getVerification({
      target: user.id,
      type: '2fa-setup',
    });

    if (existingSetup === null) {
      await verificationClient.createVerification({ target: user.id, type: '2fa-setup' });
    }

    const verificationURI = await verificationClient.get2FAVerificationURI({ target: user.id });
    const qrCodeDataURL = await toDataURL(verificationURI.otpURI);

    return { otpURI: verificationURI.otpURI, qrCodeDataURL, target: user.id };
  });
}

import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../../test-utils/render-with-router';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { TwoFactorSetupForm } from './two-factor-setup-form';

/**
 * `verify-two-factor-setup-handler.test.ts` drives every `VerifyTwoFactorSetupResult` branch
 * against the handler body directly — a plain result object never round-trips through an
 * uncompiled `createServerFn` export under `bun test`, so this file is limited to the initial
 * render.
 */
test('it renders the QR code, manual entry code, and code field', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <TwoFactorSetupForm
        otpURI="otpauth://totp/vers:user-1?secret=JBSWY3DPEHPK3PXP&issuer=vers"
        qrCodeDataURL="data:image/png;base64,abc123"
        target="user-1"
      />,
    );

    const otpInput = await screen.findByTestId('otp-input');

    expect(otpInput).toBeInTheDocument();

    expect(screen.getByAltText('QR code for 2FA setup')).toHaveAttribute(
      'src',
      'data:image/png;base64,abc123',
    );

    expect(
      screen.getByText('otpauth://totp/vers:user-1?secret=JBSWY3DPEHPK3PXP&issuer=vers'),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Enable 2FA' })).toBeInTheDocument();
  });
});

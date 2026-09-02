import { renderChangeEmailNotificationEmail } from './render-change-email-notification-email';
import { renderChangeEmailVerificationEmail } from './render-change-email-verification-email';
import { renderExistingAccountEmail } from './render-existing-account-email';
import { renderPasswordChangedEmail } from './render-password-changed-email';
import { renderResetPasswordEmail } from './render-reset-password-email';
import { renderTwoFactorEmail } from './render-two-factor-email';
import { renderWelcomeEmail } from './render-welcome-email';

interface Preview {
  name: string;
  render: () => { html: string; plainText: string };
}

export const previews: ReadonlyArray<Preview> = [
  {
    name: 'change-email-notification',
    render: () => renderChangeEmailNotificationEmail(),
  },
  {
    name: 'change-email-verification',
    render: () =>
      renderChangeEmailVerificationEmail({
        newEmail: 'new-email@example.com',
        verificationCode: '123456',
        verificationURL: 'https://versidle.com/verify-email?code=123456',
      }),
  },
  {
    name: 'existing-account',
    render: () =>
      renderExistingAccountEmail({
        email: 'player@example.com',
      }),
  },
  {
    name: 'password-changed',
    render: () =>
      renderPasswordChangedEmail({
        email: 'player@example.com',
      }),
  },
  {
    name: 'reset-password',
    render: () =>
      renderResetPasswordEmail({
        resetURL: 'https://versidle.com/reset-password?token=123456',
      }),
  },
  {
    name: 'two-factor',
    render: () =>
      renderTwoFactorEmail({
        verificationCode: '123456',
      }),
  },
  {
    name: 'welcome',
    render: () =>
      renderWelcomeEmail({
        verificationCode: '123456',
        verificationURL: 'https://versidle.com/verification?token=123456',
      }),
  },
];

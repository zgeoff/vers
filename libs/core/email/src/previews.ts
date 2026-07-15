import { renderChangeEmailNotificationEmail } from './render-change-email-notification';
import { renderChangeEmailVerificationEmail } from './render-change-email-verification';
import { renderExistingAccountEmail } from './render-existing-account-email';
import { renderPasswordChangedEmail } from './render-password-changed-email';
import { renderResetPasswordEmail } from './render-reset-password-email';
import { renderTwoFactorEmail } from './render-two-factor-email';
import { renderWelcomeEmail } from './render-welcome-email';

interface Preview {
  name: string;
  render: () => Promise<{ html: string; plainText: string }>;
}

/**
 * Sample-data render entries for every template generator, consumed by the
 * email-preview workflow (`yarn email:preview`). Entry names are the
 * generator export names kebab-cased with the `render` prefix and `Email`
 * suffix stripped; a co-located test enforces one entry per generator export.
 */
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

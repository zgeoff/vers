import { generateChangeEmailNotificationEmail } from './generate-change-email-notification';
import { generateChangeEmailVerificationEmail } from './generate-change-email-verification';
import { generateExistingAccountEmail } from './generate-existing-account-email';
import { generatePasswordChangedEmail } from './generate-password-changed-email';
import { generateResetPasswordEmail } from './generate-reset-password-email';
import { generateTwoFactorEmail } from './generate-two-factor-email';
import { generateWelcomeEmail } from './generate-welcome-email';

interface Preview {
  name: string;
  render: () => Promise<{ html: string; plainText: string }>;
}

/**
 * Sample-data render entries for every template generator, consumed by the
 * email-preview workflow (`yarn email:preview`). Entry names are the
 * generator export names kebab-cased with the `generate` prefix and `Email`
 * suffix stripped; a co-located test enforces one entry per generator export.
 */
export const previews: ReadonlyArray<Preview> = [
  {
    name: 'change-email-notification',
    render: () => generateChangeEmailNotificationEmail(),
  },
  {
    name: 'change-email-verification',
    render: () =>
      generateChangeEmailVerificationEmail({
        newEmail: 'new-email@example.com',
        verificationCode: '123456',
        verificationURL: 'https://versidle.com/verify-email?code=123456',
      }),
  },
  {
    name: 'existing-account',
    render: () =>
      generateExistingAccountEmail({
        email: 'player@example.com',
      }),
  },
  {
    name: 'password-changed',
    render: () =>
      generatePasswordChangedEmail({
        email: 'player@example.com',
      }),
  },
  {
    name: 'reset-password',
    render: () =>
      generateResetPasswordEmail({
        resetURL: 'https://versidle.com/reset-password?token=123456',
      }),
  },
  {
    name: 'two-factor',
    render: () =>
      generateTwoFactorEmail({
        verificationCode: '123456',
      }),
  },
  {
    name: 'welcome',
    render: () =>
      generateWelcomeEmail({
        verificationCode: '123456',
        verificationURL: 'https://versidle.com/verification?token=123456',
      }),
  },
];

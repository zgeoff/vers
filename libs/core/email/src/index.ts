export { createEmailClient } from './create-email-client';

export type {
  CreateEmailClientConfig,
  EmailClient,
  SendEmailInput,
  SentEmail,
} from './create-email-client';

export { renderChangeEmailNotificationEmail } from './render-change-email-notification-email';
export { renderChangeEmailVerificationEmail } from './render-change-email-verification-email';
export { renderExistingAccountEmail } from './render-existing-account-email';
export { renderPasswordChangedEmail } from './render-password-changed-email';
export { renderResetPasswordEmail } from './render-reset-password-email';
export { renderTwoFactorEmail } from './render-two-factor-email';
export { renderWelcomeEmail } from './render-welcome-email';

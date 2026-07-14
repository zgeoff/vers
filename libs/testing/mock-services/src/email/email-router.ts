import { sendChangeEmailNotification } from './send-change-email-notification';
import { sendChangeEmailVerification } from './send-change-email-verification';
import { sendExistingAccount } from './send-existing-account';
import { sendPasswordChanged } from './send-password-changed';
import { sendResetPassword } from './send-reset-password';
import { sendWelcome } from './send-welcome';

export const emailRouter = {
  sendChangeEmailNotification,
  sendChangeEmailVerification,
  sendExistingAccount,
  sendPasswordChanged,
  sendResetPassword,
  sendWelcome,
};

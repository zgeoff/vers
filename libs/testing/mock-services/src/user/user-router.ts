import { changePassword } from './change-password';
import { createPasswordResetToken } from './create-password-reset-token';
import { createUser } from './create-user';
import { getCurrentUser } from './get-current-user';
import { getUser } from './get-user';
import { resetPassword } from './reset-password';
import { updateEmail } from './update-email';
import { updateUser } from './update-user';
import { verifyPassword } from './verify-password';

export const userRouter = {
  changePassword,
  createPasswordResetToken,
  createUser,
  getCurrentUser,
  getUser,
  resetPassword,
  updateEmail,
  updateUser,
  verifyPassword,
};

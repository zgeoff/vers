import { createAvatar } from './trpc/service-avatar/create-avatar';
import { deleteAvatar } from './trpc/service-avatar/delete-avatar';
import { getAvatar } from './trpc/service-avatar/get-avatar';
import { getAvatars } from './trpc/service-avatar/get-avatars';
import { updateAvatar } from './trpc/service-avatar/update-avatar';
import { sendEmail } from './trpc/service-email/send-email';
import { createSession } from './trpc/service-session/create-session';
import { deleteSession } from './trpc/service-session/delete-session';
import { getSession } from './trpc/service-session/get-session';
import { getSessions } from './trpc/service-session/get-sessions';
import { refreshTokens } from './trpc/service-session/refresh-tokens';
import { verifySession } from './trpc/service-session/verify-session';
import { changeUserPassword } from './trpc/service-user/change-password';
import { createPasswordResetToken } from './trpc/service-user/create-password-reset-token';
import { createUser } from './trpc/service-user/create-user';
import { getUser } from './trpc/service-user/get-user';
import { resetPassword } from './trpc/service-user/reset-password';
import { updateEmail } from './trpc/service-user/update-email';
import { updateUser } from './trpc/service-user/update-user';
import { verifyPassword } from './trpc/service-user/verify-password';
import { createVerification } from './trpc/service-verification/create-verification';
import { deleteVerification } from './trpc/service-verification/delete-verification';
import { get2FAVerificationURI } from './trpc/service-verification/get-2fa-verification-uri';
import { getVerification } from './trpc/service-verification/get-verification';
import { updateVerification } from './trpc/service-verification/update-verification';
import { verifyCode } from './trpc/service-verification/verify-code';

export const handlers = [
  // service-avatar
  createAvatar,
  deleteAvatar,
  getAvatar,
  getAvatars,
  updateAvatar,

  // service-email
  sendEmail,

  // service-session
  createSession,
  deleteSession,
  getSession,
  getSessions,
  refreshTokens,
  verifySession,

  // service-user
  resetPassword,
  changeUserPassword,
  createPasswordResetToken,
  createUser,
  getUser,
  verifyPassword,
  updateUser,
  updateEmail,

  // service-verification
  createVerification,
  deleteVerification,
  get2FAVerificationURI,
  getVerification,
  updateVerification,
  verifyCode,
];

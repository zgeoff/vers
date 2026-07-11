import { createVerification } from './create-verification';
import { deleteVerification } from './delete-verification';
import { get2FAVerificationURI } from './get-2fa-verification-uri';
import { getVerification } from './get-verification';
import { updateVerification } from './update-verification';
import { verifyCode } from './verify-code';

export const verificationRouter = {
  createVerification,
  deleteVerification,
  get2FAVerificationURI,
  getVerification,
  updateVerification,
  verifyCode,
};

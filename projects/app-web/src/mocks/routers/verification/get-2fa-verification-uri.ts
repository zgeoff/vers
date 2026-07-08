import * as db from '../../db';
import { os } from './os';

export const get2FAVerificationURI = os.get2FAVerificationURI.handler((opts) => {
  const verification = db.verificationCollection.findFirst((q) =>
    q.where({ target: opts.input.target, type: '2fa-setup' }),
  );

  if (verification === undefined) {
    throw opts.errors.NOT_FOUND({ data: {} });
  }

  return {
    otpURI: `otpauth://totp/vers:${opts.input.target}?secret=JBSWY3DPEHPK3PXP&issuer=vers`,
  };
});

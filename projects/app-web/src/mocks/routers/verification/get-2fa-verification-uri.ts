import { os } from './os';

export const get2FAVerificationURI = os.get2FAVerificationURI.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

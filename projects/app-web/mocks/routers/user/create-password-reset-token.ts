import { os } from './os';

export const createPasswordResetToken = os.createPasswordResetToken.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

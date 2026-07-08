import { os } from './os';

export const resetPassword = os.resetPassword.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

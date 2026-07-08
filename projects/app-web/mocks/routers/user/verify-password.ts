import { os } from './os';

export const verifyPassword = os.verifyPassword.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

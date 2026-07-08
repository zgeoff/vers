import { os } from './os';

export const getVerification = os.getVerification.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

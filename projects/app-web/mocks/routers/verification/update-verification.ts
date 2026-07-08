import { os } from './os';

export const updateVerification = os.updateVerification.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

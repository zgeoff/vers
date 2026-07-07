import { os } from './os';

export const deleteVerification = os.deleteVerification.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

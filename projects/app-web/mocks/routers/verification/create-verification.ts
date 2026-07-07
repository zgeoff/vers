import { os } from './os';

export const createVerification = os.createVerification.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

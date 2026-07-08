import { os } from './os';

export const verifySession = os.verifySession.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

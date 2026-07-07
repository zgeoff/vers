import { os } from './os';

export const createSession = os.createSession.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

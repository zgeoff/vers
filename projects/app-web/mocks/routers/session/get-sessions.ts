import { os } from './os';

export const getSessions = os.getSessions.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

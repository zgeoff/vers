import { os } from './os';

export const deleteSession = os.deleteSession.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

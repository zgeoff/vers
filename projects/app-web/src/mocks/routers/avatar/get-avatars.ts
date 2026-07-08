import { os } from './os';

export const getAvatars = os.getAvatars.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

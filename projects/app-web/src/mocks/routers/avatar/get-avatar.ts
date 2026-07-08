import { os } from './os';

export const getAvatar = os.getAvatar.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

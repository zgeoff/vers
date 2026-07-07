import { os } from './os';

export const updateUser = os.updateUser.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

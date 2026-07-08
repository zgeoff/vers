import { os } from './os';

export const createUser = os.createUser.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

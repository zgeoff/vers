import { os } from './os';

export const refreshTokens = os.refreshTokens.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

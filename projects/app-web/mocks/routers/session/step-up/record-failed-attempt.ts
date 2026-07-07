import { os } from '../os';

export const recordFailedAttempt = os.stepUp.recordFailedAttempt.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

import { os } from '../os';

export const getPendingTransaction = os.stepUp.getPendingTransaction.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

import { os } from '../os';

export const createPendingTransaction = os.stepUp.createPendingTransaction.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

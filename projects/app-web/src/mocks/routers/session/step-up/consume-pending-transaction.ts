import { os } from '../os';

export const consumePendingTransaction = os.stepUp.consumePendingTransaction.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

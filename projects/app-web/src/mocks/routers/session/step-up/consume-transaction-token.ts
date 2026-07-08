import { os } from '../os';

export const consumeTransactionToken = os.stepUp.consumeTransactionToken.handler(() => {
  throw new Error('not wired in the phase 0b mock backend');
});

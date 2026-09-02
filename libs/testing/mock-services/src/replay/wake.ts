import { os } from './os';

export const wake = os.wake.handler(() => ({ drained: 0 }));

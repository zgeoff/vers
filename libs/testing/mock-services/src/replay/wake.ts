import { os } from './os';

/**
 * Canned success: nothing drained. A test asserting on the drained count overrides this per-test.
 */
export const wake = os.wake.handler(() => ({ drained: 0 }));

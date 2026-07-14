import { os } from './os';

/**
 * Canned success: an empty replayed segment. Re-running a real simulation needs the baked engine
 * the provider deploy carries; a test that asserts on replayed checkpoints or a
 * SIM_VERSION_MISMATCH rejection overrides this per-test.
 */
export const replaySegment = os.replaySegment.handler(() => ({ checkpoints: [], elapsed: 0 }));

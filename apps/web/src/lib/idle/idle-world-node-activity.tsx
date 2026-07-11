import { WorldNodeActivity } from '@vers/idle-client';

/**
 * Passthrough onto `lib-idle-client`'s `WorldNodeActivity` visual, at the same import boundary
 * this app already mocks under `bun test` — `happy-dom` has neither `SharedWorker` nor WebGL, so
 * the real component never renders there.
 */
export function IdleWorldNodeActivity() {
  return <WorldNodeActivity />;
}

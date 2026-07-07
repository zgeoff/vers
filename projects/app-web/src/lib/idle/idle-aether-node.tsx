import { AetherNode as LibAetherNode } from '@vers/idle-client';

/**
 * Passthrough onto `lib-idle-client`'s `AetherNode` visual, at the same import boundary this app
 * already mocks under `bun test` — `happy-dom` has neither `SharedWorker` nor WebGL, so the real
 * component never renders there.
 */
export function IdleAetherNode() {
  return <LibAetherNode />;
}

import { WorldMapEncounterActivity } from '@vers/idle-client';

/**
 * Passthrough onto `lib-idle-client`'s `WorldMapEncounterActivity` visual, at the same import
 * boundary this app already mocks under `bun test` — `happy-dom` has neither `SharedWorker` nor
 * WebGL, so the real component never renders there.
 */
export function IdleWorldMapEncounterActivity() {
  return <WorldMapEncounterActivity />;
}

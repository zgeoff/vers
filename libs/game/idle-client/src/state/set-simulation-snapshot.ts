import type { SimulationSnapshot } from '@vers/idle-core';
import { useIdleStore } from './use-idle-store';

/**
 * Applies a whole worker simulation snapshot in one `setState`, so a per-frame update triggers a
 * single notification pass instead of one per field.
 */
export function setSimulationSnapshot(snapshot: SimulationSnapshot) {
  useIdleStore.setState(() => ({
    activity: snapshot.activity ?? null,
    avatar: snapshot.avatar ?? null,
    combat: snapshot.combat ?? null,
    failureAction: snapshot.failureAction,
  }));
}

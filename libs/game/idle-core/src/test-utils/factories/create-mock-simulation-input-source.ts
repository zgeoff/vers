import { createId } from '@paralleldrive/cuid2';
import { CURRENT_CONTENT_VERSION } from '@vers/game-utils';
import type { SimulationInputSource } from '../../core/build-simulation-input';

export function createMockSimulationInputSource(
  overrides: Partial<SimulationInputSource> = {},
): SimulationInputSource {
  return {
    avatarID: createId(),
    buildSnapshot: { level: 1, xp: 0 },
    contentVersion: CURRENT_CONTENT_VERSION,
    encounterNode: { difficulty: 1 },
    id: `act_${createId()}`,
    seed: 'aa'.repeat(16),
    ...overrides,
  };
}

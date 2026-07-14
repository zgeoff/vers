import type { CombatExecutorSnapshot } from '../../types';

export function createMockCombatExecutorSnapshot(
  overrides: Readonly<Partial<CombatExecutorSnapshot>> = {},
): CombatExecutorSnapshot {
  return {
    elapsed: 0,
    ...overrides,
  };
}

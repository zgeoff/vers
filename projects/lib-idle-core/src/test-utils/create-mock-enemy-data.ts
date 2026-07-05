import type { EnemyData } from '../types';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function createMockEnemyData(overrides: Partial<EnemyData> = {}): EnemyData {
  const enemy: EnemyData = {
    level: 1,
    life: 30,
    name: 'Test Enemy',
    ...overrides,
    primaryAttack: {
      maxDamage: 3,
      minDamage: 1,
      speed: 0.5,
      ...overrides.primaryAttack,
    },
  };

  return enemy;
}

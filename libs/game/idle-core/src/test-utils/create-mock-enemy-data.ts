import type { EnemyData } from '../types';

export function createMockEnemyData(overrides: Partial<EnemyData> = {}): EnemyData {
  const enemy: EnemyData = {
    level: 1,
    life: 30,
    name: 'Test Enemy',
    xp: 10,
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

import { expect, test } from 'bun:test';
import { createEnemy } from '../../entities/create-enemy';
import { createMockEnemyData } from '../../test-utils/create-mock-enemy-data';
import { createMockSimulationContext } from '../../test-utils/create-mock-simulation-context';
import { CombatEventType } from '../../types';
import { createEnemyAttackEvent } from './create-enemy-attack-event';

test('it creates an enemy attack event', () => {
  const enemyData = createMockEnemyData();
  const ctx = createMockSimulationContext();
  const enemy = createEnemy(enemyData, ctx);
  const time = 1000;

  const event = createEnemyAttackEvent(enemy, time);

  expect(event).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    id: expect.any(String),
    source: enemy.id,
    time,
    type: CombatEventType.EnemyAttack,
  });
});

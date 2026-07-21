import { expect, test } from 'bun:test';
import { ActivityFailureAction, EntityStatus } from '@vers/idle-core';
import { simulationSnapshotSchema } from './simulation-snapshot-schema';

test('it accepts a snapshot with no run installed yet', () => {
  const snapshot = { failureAction: ActivityFailureAction.Abort };
  const result = simulationSnapshotSchema.safeParse(snapshot);

  expect(result).toMatchObject({ data: snapshot, success: true });
});

test('it accepts a full snapshot with an installed run', () => {
  const snapshot = {
    activity: {
      currentWave: {
        enemies: [
          {
            behaviours: { enemy_primary_attack: { lastAttackTime: 120 } },
            id: 'enemy_1',
            isAlive: true,
            level: 3,
            life: 40,
            maxLife: 50,
            name: 'Goblin',
            primaryAttack: { maxDamage: 6, minDamage: 2, speed: 1.2 },
            status: EntityStatus.Alive,
          },
        ],
        id: 'wave_1',
      },
      elapsed: 1500,
      enemiesRemaining: 1,
      id: 'activity_1',
      levelUp: { from: 2, to: 3 },
      name: 'Goblin Camp',
      rewards: { xp: 40 },
      waves: [],
      wavesRemaining: 0,
    },
    avatar: {
      behaviours: { avatar_weapon_attack: { lastAttackTime: 90 } },
      id: 'avatar_1',
      isAlive: true,
      level: 5,
      life: 80,
      mainHandAttack: { maxDamage: 20, minDamage: 10, speed: 1 },
      maxLife: 100,
      name: 'Hero',
      status: EntityStatus.Alive,
    },
    combat: { elapsed: 1500 },
    failureAction: ActivityFailureAction.Retry,
  };

  const result = simulationSnapshotSchema.safeParse(snapshot);

  expect(result).toMatchObject({ data: snapshot, success: true });
});

test('it rejects a snapshot missing the failure action', () => {
  const result = simulationSnapshotSchema.safeParse({});

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['failureAction'] }),
  );
});

test('it rejects a snapshot whose nested enemy status is not a declared value', () => {
  const result = simulationSnapshotSchema.safeParse({
    activity: {
      currentWave: {
        enemies: [
          {
            behaviours: {},
            id: 'enemy_1',
            isAlive: true,
            level: 3,
            life: 40,
            maxLife: 50,
            name: 'Goblin',
            primaryAttack: { maxDamage: 6, minDamage: 2, speed: 1.2 },
            status: 'stunned',
          },
        ],
        id: 'wave_1',
      },
      elapsed: 1500,
      enemiesRemaining: 1,
      id: 'activity_1',
      levelUp: null,
      name: 'Goblin Camp',
      rewards: { xp: 40 },
      waves: [],
      wavesRemaining: 0,
    },
    failureAction: ActivityFailureAction.Retry,
  });

  expect(result.success).toBeFalse();

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({
      path: ['activity', 'currentWave', 'enemies', 0, 'status'],
    }),
  );
});

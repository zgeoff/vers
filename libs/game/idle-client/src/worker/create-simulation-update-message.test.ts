import { expect, test } from 'bun:test';
import type { SimulationSnapshot } from '@vers/idle-core';
import { ActivityFailureAction, EntityStatus } from '@vers/idle-core';
import { WorkerMessageType } from '../types';
import { createSimulationUpdateMessage } from './create-simulation-update-message';

test('it creates a simulation update message', () => {
  const state: SimulationSnapshot = {
    activity: {
      currentWave: null,
      elapsed: 1000,
      enemiesRemaining: 0,
      id: '1',
      levelUp: null,
      name: 'Test Activity',
      rewards: { xp: 0 },
      waves: [],
      wavesRemaining: 0,
    },
    avatar: {
      behaviours: {},
      id: '1',
      isAlive: true,
      level: 1,
      life: 100,
      mainHandAttack: null,
      maxLife: 100,
      name: 'Test Avatar',
      status: EntityStatus.Alive,
    },
    combat: { elapsed: 1000 },
    failureAction: ActivityFailureAction.Abort,
  };

  const message = createSimulationUpdateMessage(state);

  expect(message).toStrictEqual({
    state,
    type: WorkerMessageType.SimulationUpdate,
  });
});

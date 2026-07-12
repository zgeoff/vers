import { expect, test } from 'bun:test';
import type { SimulationAppState } from '@vers/idle-core';
import { EntityStatus } from '@vers/idle-core';
import { WorkerMessageType } from '../types';
import { createInitialStateMessage } from './create-initial-state-message';

test('it creates an initial state message', () => {
  const state: SimulationAppState = {
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
    combat: { elapsed: 0 },
  };

  const message = createInitialStateMessage(state);

  expect(message).toStrictEqual({
    state,
    type: WorkerMessageType.InitialState,
  });
});

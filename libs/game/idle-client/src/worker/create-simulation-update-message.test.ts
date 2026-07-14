import { expect, test } from 'bun:test';
import type { SimulationSnapshot } from '@vers/idle-core';
import {
  ActivityFailureAction,
  createMockActivitySnapshot,
  createMockAvatarSnapshot,
  createMockCombatExecutorSnapshot,
} from '@vers/idle-core';
import { WorkerMessageType } from '../types';
import { createSimulationUpdateMessage } from './create-simulation-update-message';

test('it creates a simulation update message', () => {
  const state: SimulationSnapshot = {
    activity: createMockActivitySnapshot({ elapsed: 1000 }),
    avatar: createMockAvatarSnapshot(),
    combat: createMockCombatExecutorSnapshot({ elapsed: 1000 }),
    failureAction: ActivityFailureAction.Abort,
  };

  const message = createSimulationUpdateMessage(state);

  expect(message).toStrictEqual({
    state,
    type: WorkerMessageType.SimulationUpdate,
  });
});

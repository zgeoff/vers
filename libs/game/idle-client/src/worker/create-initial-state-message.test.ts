import { expect, test } from 'bun:test';
import type { SimulationSnapshot } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';
import {
  createMockAvatarSnapshot,
  createMockCombatExecutorSnapshot,
} from '@vers/idle-core/test-utils';
import { WorkerMessageType } from '../types';
import { createInitialStateMessage } from './create-initial-state-message';

test('it creates an initial state message', () => {
  const state: SimulationSnapshot = {
    avatar: createMockAvatarSnapshot(),
    combat: createMockCombatExecutorSnapshot(),
    failureAction: ActivityFailureAction.Abort,
  };

  const message = createInitialStateMessage(state);

  expect(message).toStrictEqual({
    state,
    type: WorkerMessageType.InitialState,
  });
});

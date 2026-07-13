import { expect, mock, test } from 'bun:test';
import { createMockActivityInput, createMockAvatarData, createSimulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import type { SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';
import { handleSetActivityMessage } from './handle-set-activity-message';
import type { WorkerContext } from './types';

function createContext(simulation: null | ReturnType<typeof createSimulation>): {
  context: WorkerContext;
  submitter: CheckpointSubmitter;
} {
  const submitter: CheckpointSubmitter = {
    attach: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve()),
  };

  const context: WorkerContext = {
    connections: new Set(),
    getSimulation: () => simulation,
    getSubmitter: () => submitter,
    removeConnection: () => {
      //
    },
    setSimulation: () => {
      //
    },
  };

  return { context, submitter };
}

test('it starts the activity on the simulation', async () => {
  const simulation = createSimulation();
  const ctx = createContext(simulation);
  const activity = createMockActivityInput();
  const avatar = createMockAvatarData();

  const message: SetActivityMessage = {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };

  await handleSetActivityMessage(ctx.context, message);

  expect(simulation.activity?.id).toBe(activity.id);
});

test('it attaches the submission context to the submitter when provided', async () => {
  const simulation = createSimulation();
  const ctx = createContext(simulation);

  const message: SetActivityMessage = {
    activity: createMockActivityInput(),
    avatar: createMockAvatarData(),
    submission: {
      activityID: 'activity_1',
      appendedHead: 0,
      lastHash: 'start_hash',
      startChainIndex: 0,
    },
    type: ClientMessageType.SetActivity,
  };

  await handleSetActivityMessage(ctx.context, message);

  expect(ctx.submitter.attach).toHaveBeenCalledExactlyOnceWith({
    activityID: 'activity_1',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });
});

test('it does not attach when the message carries no submission context', async () => {
  const simulation = createSimulation();
  const ctx = createContext(simulation);

  const message: SetActivityMessage = {
    activity: createMockActivityInput(),
    avatar: createMockAvatarData(),
    type: ClientMessageType.SetActivity,
  };

  await handleSetActivityMessage(ctx.context, message);

  expect(ctx.submitter.attach).not.toHaveBeenCalled();
});

test('it does nothing when no simulation is initialized', async () => {
  const ctx = createContext(null);

  const message: SetActivityMessage = {
    activity: createMockActivityInput(),
    avatar: createMockAvatarData(),
    submission: {
      activityID: 'activity_1',
      appendedHead: 0,
      lastHash: 'start_hash',
      startChainIndex: 0,
    },
    type: ClientMessageType.SetActivity,
  };

  await handleSetActivityMessage(ctx.context, message);

  expect(ctx.submitter.attach).not.toHaveBeenCalled();
});

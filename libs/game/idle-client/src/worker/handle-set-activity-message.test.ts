import { expect, mock, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import type { SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';
import { handleSetActivityMessage } from './handle-set-activity-message';

function buildSpySubmitter(): CheckpointSubmitter {
  return {
    attach: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve()),
  };
}

test('it starts the activity on the simulation', async () => {
  const context = createMockWorkerContext();
  const simulation = createSimulation();

  context.setSimulation(simulation);

  const activity = createMockActivityInput();
  const avatar = createMockAvatarData();

  const message: SetActivityMessage = {
    activity,
    avatar,
    type: ClientMessageType.SetActivity,
  };

  await handleSetActivityMessage(context, message);

  expect(simulation.activity?.id).toBe(activity.id);
});

test('it attaches the submission context to the submitter when provided', async () => {
  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ submitter });

  context.setSimulation(createSimulation());

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

  await handleSetActivityMessage(context, message);

  expect(submitter.attach).toHaveBeenCalledExactlyOnceWith({
    activityID: 'activity_1',
    appendedHead: 0,
    lastHash: 'start_hash',
    startChainIndex: 0,
  });
});

test('it does not attach when the message carries no submission context', async () => {
  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ submitter });

  context.setSimulation(createSimulation());

  const message: SetActivityMessage = {
    activity: createMockActivityInput(),
    avatar: createMockAvatarData(),
    type: ClientMessageType.SetActivity,
  };

  await handleSetActivityMessage(context, message);

  expect(submitter.attach).not.toHaveBeenCalled();
});

test('it does nothing when no simulation is initialized', async () => {
  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ submitter });

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

  await handleSetActivityMessage(context, message);

  expect(submitter.attach).not.toHaveBeenCalled();
});

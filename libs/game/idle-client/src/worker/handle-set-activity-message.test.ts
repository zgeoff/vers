import { expect, mock, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import type { SetActivityMessage } from '../types';
import { ClientMessageType } from '../types';
import { handleSetActivityMessage } from './handle-set-activity-message';

function buildSpySubmitter(): CheckpointSubmitter {
  return {
    flushHeld: mock(() => Promise.resolve()),
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve()),
  };
}

test('it starts the activity on the simulation', async () => {
  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ submitter });
  const simulation = createSimulation();

  context.setSimulation(simulation);

  const activity = createMockActivityData();
  const message: SetActivityMessage = { activity, type: ClientMessageType.SetActivity };

  await handleSetActivityMessage(context, message);

  expect(simulation.activity?.id).toBe(activity.id);
});

test('it registers the row against the submitter, seeded from its own chain-link fields', async () => {
  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ submitter });

  context.setSimulation(createSimulation());

  const activity = createMockActivityData({
    appendedHead: 2,
    id: 'activity_1',
    lastHash: 'head_hash',
    startChainIndex: 3,
  });

  const message: SetActivityMessage = { activity, type: ClientMessageType.SetActivity };

  await handleSetActivityMessage(context, message);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: 'activity_1',
    appendedHead: 2,
    lastHash: 'head_hash',
    startChainIndex: 3,
  });
});

test('it remembers the row as the live simulation source', async () => {
  const context = createMockWorkerContext();

  context.setSimulation(createSimulation());

  const activity = createMockActivityData();
  const message: SetActivityMessage = { activity, type: ClientMessageType.SetActivity };

  await handleSetActivityMessage(context, message);

  expect(context.getActivity()).toStrictEqual(activity);
});

test('it does nothing when no simulation is initialized', async () => {
  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ submitter });

  const message: SetActivityMessage = {
    activity: createMockActivityData(),
    type: ClientMessageType.SetActivity,
  };

  await handleSetActivityMessage(context, message);

  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

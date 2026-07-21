import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { handleInitializeMessage } from './handle-initialize-message';

test('it answers with the current simulation snapshot', () => {
  const context = createStubWorkerContext();
  const result = handleInitializeMessage(context);

  expect(result).toStrictEqual({
    rewardSlotLedger: { activityID: null, entries: [] },
    state: context.getSimulation().getSnapshot(),
    writerDisplacedActivityID: null,
  });
});

test('it answers with the retained reward-slot ledger for a mid-run call', () => {
  const context = createStubWorkerContext();

  context.setSimulation(createSimulation());
  context.recordRewardSlots('activity_1', { count: 2, version: 1 });

  const result = handleInitializeMessage(context);

  expect(result).toStrictEqual({
    rewardSlotLedger: { activityID: 'activity_1', entries: [{ count: 2, version: 1 }] },
    state: context.getSimulation().getSnapshot(),
    writerDisplacedActivityID: null,
  });
});

test('it does not create a new simulation if one already exists', () => {
  const context = createStubWorkerContext();
  const existingSimulation = createSimulation();

  context.setSimulation(existingSimulation);

  handleInitializeMessage(context);

  expect(context.getSimulation()).toBe(existingSimulation);
});

test('it carries a held displacement in the answer', () => {
  const context = createStubWorkerContext();

  context.setSimulation(createSimulation());
  context.setWriterDisplacedActivityID('activity_9');

  const result = handleInitializeMessage(context);

  expect(result.writerDisplacedActivityID).toBe('activity_9');
});

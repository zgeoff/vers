import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { findLiveRun } from './find-live-run';

test('it names the avatar and scope of the run whose simulation is ticking', () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const activity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(activity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: activity.id }));

  expect(findLiveRun(context)).toStrictEqual({
    avatarID: activity.avatarID,
    id: activity.id,
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  });
});

test('it finds no run while the worker holds no row', () => {
  const context = createStubWorkerContext();

  expect(findLiveRun(context)).toBeUndefined();
});

test('it finds no run once the held row has stopped ticking', () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();
  const activity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(activity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: activity.id }));
  simulation.stopActivity();

  expect(findLiveRun(context)).toBeUndefined();
});

test('it finds no run while the simulation ticks a row other than the held one', () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();

  context.setSimulation(simulation);
  context.setActivity(createMockActivityData());
  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  expect(findLiveRun(context)).toBeUndefined();
});

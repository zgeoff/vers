import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { handleSimulationUpdate } from './handle-simulation-update';

test('it broadcasts a simulation update message', () => {
  const simulation = createSimulation();
  const context = createStubWorkerContext();

  context.setSimulation(simulation);

  handleSimulationUpdate(context);

  expect(context.getBroadcasts()).toStrictEqual([
    { state: simulation.getSnapshot(), type: WorkerMessageType.SimulationUpdate },
  ]);
});

test('it names the live run beside the snapshot while a row is ticking', () => {
  const simulation = createSimulation();
  const context = createStubWorkerContext();
  const activity = createMockActivityData();

  context.setSimulation(simulation);
  context.setActivity(activity);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: activity.id }));

  handleSimulationUpdate(context);

  expect(context.getBroadcasts()).toStrictEqual([
    {
      liveRun: {
        avatarID: activity.avatarID,
        id: activity.id,
        scopeID: activity.scopeID,
        scopeType: activity.scopeType,
      },
      state: simulation.getSnapshot(),
      type: WorkerMessageType.SimulationUpdate,
    },
  ]);
});

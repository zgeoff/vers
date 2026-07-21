import { expect, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
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

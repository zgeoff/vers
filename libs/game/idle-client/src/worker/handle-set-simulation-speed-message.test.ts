import { expect, test } from 'bun:test';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { handleSetSimulationSpeedMessage } from './handle-set-simulation-speed-message';

test('it applies a speed above real time for a QA avatar and broadcasts it', () => {
  const context = createStubWorkerContext();
  const result = handleSetSimulationSpeedMessage(context, { isQAAvatar: true, speed: 20 });

  expect(result).toStrictEqual({ kind: 'applied', speed: 20 });
  expect(context.getSimulationSpeed()).toBe(20);

  expect(context.getBroadcasts()).toStrictEqual([
    { speed: 20, type: WorkerMessageType.SimulationSpeedStatus },
  ]);

  expect(context.getDebugRecorder().getEvents()).toPartiallyContain({
    detail: '20',
    type: 'speed',
  });
});

test('it refuses a speed above real time for an avatar that is not flagged for QA', () => {
  const context = createStubWorkerContext();
  const result = handleSetSimulationSpeedMessage(context, { isQAAvatar: false, speed: 2 });

  expect(result).toStrictEqual({ kind: 'refused', reason: 'avatar-not-qa' });
  expect(context.getSimulationSpeed()).toBe(1);
  expect(context.getBroadcasts()).toStrictEqual([]);
});

test('it returns an unflagged avatar to real time', () => {
  const context = createStubWorkerContext();

  context.setSimulationSpeed(5);

  const result = handleSetSimulationSpeedMessage(context, { isQAAvatar: false, speed: 1 });

  expect(result).toStrictEqual({ kind: 'applied', speed: 1 });
  expect(context.getSimulationSpeed()).toBe(1);
});

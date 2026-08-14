import { expect, mock, test } from 'bun:test';
import { createSimulation } from '@vers/idle-core';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { WorkerMessageType } from '../types';
import { createStubWorkerContext } from './create-stub-worker-context';

test('it creates a context with no broadcasts and an empty simulation by default', () => {
  const context = createStubWorkerContext();

  expect(context.getBroadcasts()).toStrictEqual([]);
  expect(context.getSimulation().activity).toBeNull();
});

test('it records every broadcast and forwards it to the given callback', () => {
  const received: Array<unknown> = [];

  const context = createStubWorkerContext({
    broadcast: (message) => {
      received.push(message);
    },
  });

  context.broadcast({ activityID: 'activity_1', type: WorkerMessageType.WriterDisplaced });

  expect(context.getBroadcasts()).toStrictEqual([
    { activityID: 'activity_1', type: WorkerMessageType.WriterDisplaced },
  ]);

  expect(received).toStrictEqual([
    { activityID: 'activity_1', type: WorkerMessageType.WriterDisplaced },
  ]);
});

test('it stores and returns the simulation set on it', () => {
  const context = createStubWorkerContext();
  const simulation = createSimulation();

  context.setSimulation(simulation);

  expect(context.getSimulation()).toBe(simulation);
});

test('it returns the injected submitter', () => {
  const submitter: CheckpointSubmitter = {
    flushHeld: mock(() => Promise.resolve()),
    flushNow: mock(() => Promise.resolve()),
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve(undefined)),
    isEvicted: mock(() => false),
    removeEviction: mock(() => {}),
  };

  const context = createStubWorkerContext({ submitter });

  expect(context.getSubmitter()).toBe(submitter);
});

test('it reflects updateConnectivity on getConnectivity', () => {
  const context = createStubWorkerContext();

  expect(context.getConnectivity()).toBeTrue();

  context.updateConnectivity(false);

  expect(context.getConnectivity()).toBeFalse();
});

test('it reflects an externally aborted shutdown controller on the cancel signal', () => {
  const shutdownController = new AbortController();

  const context = createStubWorkerContext({ shutdownController });

  shutdownController.abort();

  expect(context.getCancelSignal().aborted).toBeTrue();
  expect(context.getStopSignal().aborted).toBeFalse();
});

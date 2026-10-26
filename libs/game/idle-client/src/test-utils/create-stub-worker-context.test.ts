import { expect, mock, test } from 'bun:test';
import type { ActivityData } from '@vers/contract-activity';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { buildSessionSupersededResponse } from '@vers/service-utils/orpc';
import { waitFor } from '@vers/test-utils';
import { http } from 'msw';
import { server } from '../mocks/node';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import { writeActivityStart } from '../submission/write-activity-start';
import { WorkerMessageType } from '../types';
import { createStubWorkerContext } from './create-stub-worker-context';

test('it writes a start row through the injected writer', async () => {
  const writeMintedActivityStartStub = mock(async (_row: Readonly<ActivityData>) => {});

  const context = createStubWorkerContext({
    writeMintedActivityStart: writeMintedActivityStartStub,
  });

  const row = createMockActivityData();

  await context.writeMintedActivityStart(row);

  expect(writeMintedActivityStartStub).toHaveBeenCalledExactlyOnceWith(row);
});

test('it writes a start row and its last-started record to the outbox by default', async () => {
  const context = createStubWorkerContext();
  const row = createMockActivityData();

  await context.writeMintedActivityStart(row);

  const starts = await readAllActivityStarts();
  const lastStarted = await readLastStartedActivity(row.avatarID);

  expect(starts).toStrictEqual([row]);
  expect(lastStarted).toStrictEqual({ avatarID: row.avatarID, lastActivityID: row.id });
});

test('it discards the outbox when its proxy client meets the superseded marker', async () => {
  server.use(
    http.post(`${self.location.origin}/api/rpc/activity/getCurrentActivity`, () =>
      buildSessionSupersededResponse(),
    ),
  );

  await writeActivityStart(createMockActivityData());

  const context = createStubWorkerContext({ activityProxy: true });

  await expect(context.getClient().getCurrentActivity({ avatarID: 'avatar-1' })).toReject();

  await waitFor(async () => {
    const remaining = await readAllActivityStarts();

    expect(remaining).toStrictEqual([]);
  });
});

test('it creates a context with no broadcasts and an empty simulation by default', () => {
  const context = createStubWorkerContext();

  expect(context.getBroadcasts()).toStrictEqual([]);
  expect(context.getSimulation().activity).toBeNull();
  expect(context.isTickingStopped()).toBeFalse();
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
    collectActivityStates: mock(() => []),
    isEvicted: mock(() => false),
    removeEviction: mock(() => {}),
    removeRegistrations: mock(() => {}),
  };

  const context = createStubWorkerContext({ submitter });

  expect(context.getSubmitter()).toBe(submitter);
});

test('it reflects an externally aborted shutdown controller on the cancel signal', () => {
  const shutdownController = new AbortController();

  const context = createStubWorkerContext({ shutdownController });

  shutdownController.abort();

  expect(context.getCancelSignal().aborted).toBeTrue();
  expect(context.getStopSignal().aborted).toBeFalse();
});

test('it reports the ticks stopped once the runtime is told to stop them', () => {
  const context = createStubWorkerContext();

  context.stopTicking();

  expect(context.isTickingStopped()).toBeTrue();
});

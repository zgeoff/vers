import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityCheckpointType } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import type { ActivityServiceClient } from '../submission/types';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { WorkerMessageType } from '../types';
import { runResyncFlow } from './run-resync-flow';
import type { FlowSignals } from './types';

test('it resets a held run belonging to another avatar before installing', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });

  // a run held for a different avatar can only arrive through the switch guard's TOCTOU gap
  context.setActivity(createMockActivityData({ avatarID: 'someone-else' }));

  const before = context.getSimulation();

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  expect(context.getActivity()).toBeNull();
  expect(context.getSimulation()).not.toBe(before);
});

test('it leaves the avatar idle with no live attach after an offline gap aborts on a failure', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client, submitter });

  // an overwhelming difficulty guarantees the very first enemy hit kills the avatar, so the
  // default Abort failure action stops the offline gap on its first attempt
  await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 100_000 },
    status: 'active',
    verifiedHead: 0,
  });

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  expect(context.getBroadcasts().at(-1)).toStrictEqual({
    status: { attempts: 1, kind: 'done', levelUps: 0 },
    type: WorkerMessageType.ResyncStatus,
  });

  expect(context.getActivity()).toBeNull();
  expect(context.getSimulation().activity).toBeNull();
  expect(submitter.registerActivity).not.toHaveBeenCalled();

  // the abort mints its final continuation's row server-side exactly like any other, but nothing
  // ever attaches it live — left active it would sit ready for the very next resync to revive
  expect(
    db.activityCollection.findFirst((q) =>
      q.where({ avatarID: viewer.avatar.id, status: 'active' }),
    ),
  ).toBeUndefined();
});

test('it attaches nothing on a second resync after an offline gap aborted on a failure', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client, submitter });

  await db.activityCollection.create({
    appendedAt: new Date(Date.now() - 60_000),
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    encounterNode: { difficulty: 100_000 },
    status: 'active',
    verifiedHead: 0,
  });

  const firstSignals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, firstSignals);

  const broadcastsAfterFirstResync = context.getBroadcasts().length;

  const secondSignals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, secondSignals);

  // a connectivity-proof resync that finds no active row plans nothing to attach and broadcasts
  // no further progression — the mint the aborted gap left behind must never resurface a
  // post-death attempt on this or any later reconnect
  expect(context.getBroadcasts()).toHaveLength(broadcastsAfterFirstResync);
  expect(context.getActivity()).toBeNull();
  expect(context.getSimulation().activity).toBeNull();
  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

test("it seeds the run's earnings record from the reconstructed prefix when it attaches mid-stream", async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  // one confirmed checkpoint at the head: the reconstruction replays the started checkpoint the
  // live tick never saw, and the record must carry it so the next mint folds from this run
  const activity = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    startedAt: new Date(),
  });

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  expect(context.getSimulation().activity?.id).toBe(activity.id);

  expect(context.getRunEarnings()).toMatchObject({
    activityID: activity.id,
    deltaXP: 0,
    tail: { seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072', type: ActivityCheckpointType.Started },
  });
});

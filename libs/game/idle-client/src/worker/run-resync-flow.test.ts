import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { ActivityCheckpointType, buildLevelFromXP } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import { readLastStartedActivity } from '../submission/read-last-started-activity';
import type { ActivityServiceClient } from '../submission/types';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { createMockProgressCheckpoint } from '../test-utils/factories/create-mock-progress-checkpoint';
import { WorkerMessageType } from '../types';
import { buildActivityStart } from './build-activity-start';
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

  expect(context.getLatestRun()).toMatchObject({
    activityID: activity.id,
    avatarID: viewer.avatar.id,
    baselineXP: activity.buildSnapshot.xp,
    deltaXP: 0,
    tail: { seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072', type: ActivityCheckpointType.Started },
  });
});

test("it mints the next start from the server-closed latest run's snapshot and predecessor on a worker with empty stores", async () => {
  const viewer = await createViewer({ avatar: { xp: 436 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_1',
    client,
    submitter: createStubSubmitter(),
  });

  // the previous device's fast-forward left this row: stopped, with nothing appended past its
  // own start, at the snapshot the server folded when it minted it
  const closed = await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(436), xp: 436 },
    status: 'stopped',
    verifiedHead: 0,
  });

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  const seed = createMockNodeSeed({ avatarID: viewer.avatar.id, nodeID: '0_0' });

  await writeNodeSeeds(viewer.avatar.id, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  const row = await buildActivityStart(context, {
    avatarID: viewer.avatar.id,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_fresh_device',
  });

  invariant(row !== null, 'expected the cached inputs to synthesize a row');

  expect(context.getActivity()).toBeNull();
  expect(row.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(436), xp: 436 });
  expect(row.predecessorActivityID).toBe(closed.id);
});

test("it folds a stopped run's unverified xp through the server's own build when this worker never played it", async () => {
  const viewer = await createViewer({ avatar: { xp: 436 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_1',
    client,
    submitter: createStubSubmitter(),
  });

  // a run another device cleared: its terminal total is still owed on top of the settled xp
  const cleared = await db.activityCollection.create({
    appendedHead: 1,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(436), xp: 436 },
    status: 'stopped',
    verifiedHead: 0,
  });

  await db.checkpointCollection.create({
    activityID: cleared.id,
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      rewards: { xp: 40 },
      seed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
      time: 1000,
      type: 'completed',
    },
    version: 1,
  });

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  const seed = createMockNodeSeed({ avatarID: viewer.avatar.id, nodeID: '0_0' });

  await writeNodeSeeds(viewer.avatar.id, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  const row = await buildActivityStart(context, {
    avatarID: viewer.avatar.id,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_second_device',
  });

  invariant(row !== null, 'expected the cached inputs to synthesize a row');

  expect(row.buildSnapshot).toStrictEqual({ level: buildLevelFromXP(476), xp: 476 });
  expect(row.predecessorActivityID).toBe(cleared.id);
});

test('it keeps a recorded run that is still an undelivered start ahead of the fetched row', async () => {
  const viewer = await createViewer({ avatar: { xp: 436 } });
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  const closed = await db.activityCollection.create({
    appendedHead: 0,
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(436), xp: 436 },
    status: 'stopped',
    verifiedHead: 0,
  });

  // a start this device minted on the closed row and has not delivered yet: it succeeds the
  // fetched row, so neither record may fall back to the server's older view
  const pending = createMockActivityData({
    avatarID: viewer.avatar.id,
    buildSnapshot: { level: buildLevelFromXP(436), xp: 436 },
    id: 'act_pending_local',
    predecessorActivityID: closed.id,
  });

  await writeActivityStart(pending);
  await writeLastStartedActivity({ avatarID: viewer.avatar.id, lastActivityID: pending.id });

  const recorded = {
    activityID: pending.id,
    avatarID: viewer.avatar.id,
    baselineXP: 436,
    deltaXP: 20,
    tail: createMockProgressCheckpoint({ rewards: { xp: 20 } }),
  };

  context.setLatestRun(recorded);

  const signals: FlowSignals = {
    cancel: context.getCancelSignal(),
    stop: context.getStopSignal(),
  };

  await runResyncFlow(context, viewer.avatar.id, false, signals);

  expect(context.getLatestRun()).toBe(recorded);

  expect(readLastStartedActivity(viewer.avatar.id)).resolves.toStrictEqual({
    avatarID: viewer.avatar.id,
    lastActivityID: pending.id,
  });
});

test('it records the final mint of an aborted offline gap as the next fold source and predecessor', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

  const original = await db.activityCollection.create({
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

  // the abort stops the gap's final continuation back rather than attaching it, so nothing on
  // this worker installed it — the record still has to name it, or the next mint folds from the
  // row the gap started on
  const finalMint = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, id: (id) => id !== original.id }),
  );

  invariant(finalMint !== undefined, 'the aborted gap minted its final continuation');

  expect(context.getLatestRun()).toStrictEqual({
    activityID: finalMint.id,
    avatarID: viewer.avatar.id,
    baselineXP: finalMint.buildSnapshot.xp,
    deltaXP: 0,
    tail: null,
  });

  expect(readLastStartedActivity(viewer.avatar.id)).resolves.toStrictEqual({
    avatarID: viewer.avatar.id,
    lastActivityID: finalMint.id,
  });
});

test('it records a live-attached row as the predecessor on a worker with empty stores', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client, submitter: createStubSubmitter() });

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

  // the attach keeps the record its reconstruction seeded, and a start after a player stop reads
  // the durable predecessor this device never wrote itself
  expect(context.getActivity()?.id).toBe(activity.id);
  expect(context.getLatestRun()).toMatchObject({ activityID: activity.id, deltaXP: 0 });

  expect(readLastStartedActivity(viewer.avatar.id)).resolves.toStrictEqual({
    avatarID: viewer.avatar.id,
    lastActivityID: activity.id,
  });
});

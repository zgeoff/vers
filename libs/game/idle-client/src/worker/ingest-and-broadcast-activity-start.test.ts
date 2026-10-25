import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import { server } from '../mocks/node';
import { readActivityStart } from '../submission/read-activity-start';
import type { ActivityServiceClient } from '../submission/types';
import { writeActivityStart } from '../submission/write-activity-start';
import { writeLastStartedActivity } from '../submission/write-last-started-activity';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { WorkerMessageType } from '../types';
import { ingestAndBroadcastActivityStart } from './ingest-and-broadcast-activity-start';
import { loadActivityStart } from './load-activity-start';
import { RunOutcomeKind } from './run-outcome-schema';

test('it announces an ingested activity start to connected tabs', async () => {
  const context = createStubWorkerContext();
  const row = createMockActivityData({ id: 'act_broadcast_ok', startKey: 'start_key_ok' });

  server.use(
    mockActivityService.advanceActivity.handler(() => ({ activity: row, appendedHead: 0 })),
  );

  await writeActivityStart(row);

  const outcome = await ingestAndBroadcastActivityStart(context, row.id);

  expect(outcome).toBe('ingested');

  expect(context.getBroadcasts()).toContainEqual({
    activityID: row.id,
    type: WorkerMessageType.ActivityStartIngested,
  });
});

test('it broadcasts the avatar-switched notice when the account moved to another avatar', async () => {
  const context = createStubWorkerContext();
  const row = createMockActivityData({ id: 'act_broadcast_switch', startKey: 'start_key_switch' });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.AVATAR_NOT_ACTIVE({
        data: { activeAvatarID: 'avatar_other', activeAvatarName: 'Zetha' },
      });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestAndBroadcastActivityStart(context, row.id);

  expect(outcome).toBe('deferred');

  expect(context.getBroadcasts()).toContainEqual({
    status: { activeAvatarName: 'Zetha', attempts: 0, kind: 'avatar-switched', levelUps: 0 },
    type: WorkerMessageType.ResyncStatus,
  });
});

test('it broadcasts the sim-version-expired notice when this build can no longer replay', async () => {
  const context = createStubWorkerContext();

  const row = createMockActivityData({
    id: 'act_broadcast_expired',
    startKey: 'start_key_expired',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.SIM_VERSION_EXPIRED({ data: { currentSimVersion: 'engine_hash_9' } });
    }),
  );

  await writeActivityStart(row);

  const outcome = await ingestAndBroadcastActivityStart(context, row.id);

  expect(outcome).toBe('rejected');

  expect(context.getBroadcasts()).toContainEqual({
    status: { kind: 'sim-version-expired' },
    type: WorkerMessageType.ResyncStatus,
  });
});

test('it halts a live run whose own start the server refused for good and tells the player', async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ client });
  const simulation = createSimulation();

  const landed = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'stopped',
  });

  const live = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_broadcast_refused_live',
    predecessorActivityID: landed.id,
    startKey: 'start_key_refused_live',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CHECKPOINT_INVALID({
        data: {
          activityID: live.id,
          appendedHead: 0,
          avatarID: live.avatarID,
          reason: 'build-snapshot-mismatch',
        },
      });
    }),
  );

  await writeActivityStart(live);

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: live.id }));
  context.setSimulation(simulation);
  context.setActivity(live);

  const outcome = await ingestAndBroadcastActivityStart(context, live.id);

  expect(outcome).toBe('rejected');
  expect(simulation.activity).toBeNull();
  expect(context.getActivity()).toBeNull();

  expect(context.getBroadcasts()).toContainEqual({
    outcome: {
      activityID: live.id,
      avatarID: viewer.avatar.id,
      kind: RunOutcomeKind.Refused,
      scope: { scopeID: live.scopeID, scopeType: live.scopeType },
      xp: 0,
    },
    type: WorkerMessageType.ActivityEnded,
  });
});

test("it mints the next start at a node on the server's anchor after one refusal, once a rejection rewound the chain behind the device's cache", async () => {
  const viewer = await createViewer();
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', viewer.user.id);

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1', client });

  const rejected = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    status: 'rejected',
  });

  const seed = createMockNodeSeed({
    avatarID: viewer.avatar.id,
    anchor: { chainIndex: 9, nextSeed: 'seed_local_9' },
    nodeID: '2_3',
  });

  const refused = createMockActivityData({
    avatarID: viewer.avatar.id,
    id: 'act_broadcast_rewound',
    predecessorActivityID: rejected.id,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    seed: 'seed_local_9',
    startChainIndex: 9,
    startKey: 'start_key_rewound',
  });

  server.use(
    mockActivityService.advanceActivity.handler((opts) => {
      throw opts.errors.CONFLICT({
        data: {
          activityID: refused.id,
          anchor: { chainIndex: 4, nextSeed: 'seed_server_4' },
          appendedHead: 0,
          avatarID: refused.avatarID,
          reason: 'stale-chain-head',
        },
      });
    }),
  );

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });
  await writeActivityStart(refused);
  await writeLastStartedActivity({ avatarID: refused.avatarID, lastActivityID: refused.id });

  const outcome = await ingestAndBroadcastActivityStart(context, refused.id);

  expect(outcome).toBe('rejected');

  const stored = await readActivityStart(refused.id);

  expect(stored).toBeUndefined();

  const next = await loadActivityStart(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
    startKey: 'start_key_after_rewind',
  });

  invariant(next !== null, 'expected the cached node to mint the next start');

  expect(next).toMatchObject({
    predecessorActivityID: rejected.id,
    seed: 'seed_server_4',
    startChainIndex: 4,
  });
});

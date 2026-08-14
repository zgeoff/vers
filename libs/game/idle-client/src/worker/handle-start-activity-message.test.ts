import { expect, mock, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import { createMockContentDocument } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createAuthedServiceClient, createViewer } from '@vers/mock-services';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { HttpResponse } from 'msw';
import invariant from 'tiny-invariant';
import { writeContentDocumentCache } from '../content/write-content-document-cache';
import { server } from '../mocks/node';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readAllOfflineStartRows } from '../submission/read-all-offline-start-rows';
import { readOfflineStartRow } from '../submission/read-offline-start-row';
import { readPendingStopIntent } from '../submission/read-pending-stop-intent';
import type { ActivityServiceClient } from '../submission/types';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { WorkerMessageType } from '../types';
import { handleStartActivityMessage } from './handle-start-activity-message';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

interface SetupTestConfig {
  readonly userID: string;
}

/**
 * Builds an authed client acting as the given user, so start calls hit the same mint, conflict,
 * and duplicate-start logic the real service applies to the rows the test seeds in the mock db.
 */
async function setupTest(config: Readonly<SetupTestConfig>) {
  const client = await createAuthedServiceClient<ActivityServiceClient>('activity', config.userID);

  return { client };
}

test('it mints a row, installs it, and answers with the started status', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });

  context.setSimulation(createSimulation());

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the start to mint an active row');

  expect(minted.scopeID).toBe('0_0');
  expect(context.getSimulation()?.activity?.id).toBe(minted.id);
  expect(context.getActivity()?.id).toBe(minted.id);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: minted.id,
    appendedHead: 0,
    lastHash: minted.lastHash,
    startChainIndex: minted.startChainIndex,
  });

  invariant(result.kind === 'started', 'expected a started status');

  expect(result.activity.id).toBe(minted.id);
});

test('it installs a simulation even when none was initialized yet', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the start to mint an active row');

  expect(context.getSimulation()?.activity?.id).toBe(minted.id);
});

test('it resyncs onto the already-active row when the same scope conflicts', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const running = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'someone-elses-start',
    status: 'active',
  });

  const context = createStubWorkerContext({
    client: ctx.client,
    submitter: createStubSubmitter(),
  });

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(context.getSimulation()?.activity?.id).toBe(running.id);
  expect(result).toStrictEqual({ activityID: running.id, kind: 'attached' });
});

test('it flushes and stops a different scope before starting the requested one', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const previous = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: '5_0',
    scopeType: 'world_map_node',
    status: 'active',
  });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ client: ctx.client, submitter });

  context.setSimulation(createSimulation());

  await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const stopped = db.activityCollection.findFirst((q) => q.where({ id: previous.id }));

  invariant(stopped !== undefined, 'expected the previous row to survive');

  expect(stopped.status).toBe('stopped');
  expect(submitter.flushNow).toHaveBeenCalledExactlyOnceWith(previous.id);

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the start to mint an active row');

  expect(minted.scopeID).toBe('0_0');
  expect(context.getSimulation()?.activity?.id).toBe(minted.id);
});

test('it stops the minted row back when a stop lands mid-start', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({
    client: ctx.client,
    submitter: createStubSubmitter(),
  });

  context.setSimulation(createSimulation());

  // the stop lands while the start call is in flight; the mock ignores the call's own token and
  // always answers with this pre-minted row, standing in for the service's real answer
  const minted = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'seed-key',
    status: 'active',
  });

  server.use(
    mockActivityService.startActivity.handler(() => {
      context.advanceStopScope();

      return minted;
    }),
  );

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const row = db.activityCollection.findFirst((q) => q.where({ id: minted.id }));

  invariant(row !== undefined, 'expected the minted row to survive');

  expect(row.status).toBe('stopped');
  expect(context.getActivity()).toBeNull();

  const intent = await readPendingStopIntent();

  expect(intent).toBeUndefined();
  expect(result).toStrictEqual({ kind: 'failed' });
});

test('it answers failed without reporting a fault when a worker shutdown aborts the entry check before any row mints', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const shutdownController = new AbortController();

  // shutdown is permanent, unlike a stop scope's reset-on-advance — aborting it before the flow
  // ever runs is how a worker reload's abort reaches this entry check
  shutdownController.abort();

  const context = createStubWorkerContext({
    shutdownController,
    submitter: createStubSubmitter(),
  });

  const result = await handleStartActivityMessage(context, {
    avatarID: 'avatar_1',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const minted = db.activityCollection.findMany((q) => q.where({ avatarID: 'avatar_1' }));

  expect(minted).toStrictEqual([]);
  expect(result).toStrictEqual({ kind: 'failed' });
  expect(recorded).toStrictEqual([]);
});

test('it abandons a superseded call without touching the fresher claim', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  context.setSimulation(createSimulation());

  const minted = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'seed-key',
    status: 'active',
  });

  // a fresher selection claims the runtime while this call is in flight
  server.use(
    mockActivityService.startActivity.handler(() => {
      context.setStartToken('a-fresher-token');

      return minted;
    }),
  );

  await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const row = db.activityCollection.findFirst((q) => q.where({ id: minted.id }));

  invariant(row !== undefined, 'expected the minted row to survive');

  expect(row.status).toBe('active');
  expect(context.getActivity()).toBeNull();
});

test('it leaves the conflicting row running when a fresher call supersedes during the flush', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const previous = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: '5_0',
    scopeType: 'world_map_node',
    status: 'active',
  });

  // the flush is the replace flow's only yield between the supersession checks; scripting the
  // fresher claim into it lands the supersession right before the stop would go out
  const flushEffect = { current: () => {} };

  const submitter: CheckpointSubmitter = {
    ...createStubSubmitter(),
    flushNow: mock(() => {
      flushEffect.current();

      return Promise.resolve();
    }),
  };

  const context = createStubWorkerContext({ client: ctx.client, submitter });

  flushEffect.current = () => {
    context.setStartToken('a-fresher-token');
  };

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const row = db.activityCollection.findFirst((q) => q.where({ id: previous.id }));

  invariant(row !== undefined, 'expected the conflicting row to survive');

  expect(row.status).toBe('active');
  expect(result).toStrictEqual({ kind: 'failed' });
});

test('it answers failed on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  const result = await handleStartActivityMessage(context, {
    avatarID: 'avatar_1',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ kind: 'failed' });
});

test('it fails an attach the resync could not install', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
    startKey: 'someone-elses-start',
    status: 'active',
  });

  const context = createStubWorkerContext({
    client: ctx.client,
    submitter: createStubSubmitter(),
  });

  // the attach resync's own progress fetch fails, so it installs nothing — the status must not
  // promise a row the runtime never installed
  server.use(mockActivityService.getLatestActivityProgress.handler(() => HttpResponse.error()));

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(context.getSimulation().activity).toBeNull();
  expect(result).toStrictEqual({ kind: 'failed' });

  expect(context.getBroadcasts()).toStrictEqual([
    {
      status: { avatarID: viewer.avatar.id, kind: 'failed' },
      type: WorkerMessageType.ResyncStatus,
    },
  ]);
});

test('it runs interleaved starts one at a time, the fresher claim winning', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  context.setSimulation(createSimulation());

  // both calls land before either flow runs — the chain must run them in order, so the first
  // completes fully before the second's conflict recovery replaces its row
  await Promise.all([
    handleStartActivityMessage(context, {
      avatarID: viewer.avatar.id,
      scopeID: '1_0',
      scopeType: 'world_map_node',
    }),
    handleStartActivityMessage(context, {
      avatarID: viewer.avatar.id,
      scopeID: '0_0',
      scopeType: 'world_map_node',
    }),
  ]);

  const active = db.activityCollection.findMany((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  expect(active).toHaveLength(1);

  invariant(active[0] !== undefined, 'expected one active row');

  expect(active[0].scopeID).toBe('0_0');
  expect(context.getActivity()?.id).toBe(active[0].id);
});

test('it takes over and stops a different scope another writer owns before starting the requested one', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const previous = await db.activityCollection.create({
    avatarID: viewer.avatar.id,
    scopeID: '5_0',
    scopeType: 'world_map_node',
    status: 'active',
  });

  // the conflicting run belongs to another device's writer until this session claims it back
  let claimed = false;

  server.use(
    mockActivityService.stopActivity.handler((opts) => {
      if (!claimed) {
        throw opts.errors.SESSION_EVICTED({ data: {} });
      }

      const row = db.activityCollection.findFirst((q) => q.where({ id: previous.id }));

      invariant(row !== undefined, 'expected the previous row to survive the stop');

      return db.activityCollection.update(row, {
        data(record) {
          record.status = 'stopped';
        },
        strict: true,
      });
    }),
    mockActivityService.resumeActivity.handler(() => {
      claimed = true;

      return previous;
    }),
  );

  const context = createStubWorkerContext({ client: ctx.client });

  context.setSimulation(createSimulation());

  await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  const stopped = db.activityCollection.findFirst((q) => q.where({ id: previous.id }));

  invariant(stopped !== undefined, 'expected the previous row to survive');

  expect(stopped.status).toBe('stopped');

  const minted = db.activityCollection.findFirst((q) =>
    q.where({ avatarID: viewer.avatar.id, status: 'active' }),
  );

  invariant(minted !== undefined, 'expected the start to mint an active row');

  expect(minted.scopeID).toBe('0_0');
  expect(context.getSimulation()?.activity?.id).toBe(minted.id);
});

test("it settles a start rejected for a non-active avatar as failed, carrying the active avatar's name", async () => {
  const viewer = await createViewer();
  const otherAvatar = await db.avatarCollection.create({ userID: viewer.user.id });
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  const result = await handleStartActivityMessage(context, {
    avatarID: otherAvatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({
    kind: 'failed',
    rejection: { activeAvatarName: viewer.avatar.name, reason: 'avatar-not-active' },
  });
});

test('it settles a start rejected as SIM_VERSION_EXPIRED as failed with a sim-version-expired rejection', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.SIM_VERSION_EXPIRED({ data: { currentSimVersion: null } });
    }),
  );

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({
    kind: 'failed',
    rejection: { reason: 'sim-version-expired' },
  });
});

test('it starts normally when a bundled hash reads back unknown but the registry-current retry succeeds', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_baked',
    client: ctx.client,
    submitter: createStubSubmitter(),
  });

  // the first call's hash misses a registry write still in flight for this deploy; the retry
  // drops the hash and lands on the registry's current stamp instead
  const sentSimVersions: Array<string | undefined> = [];

  server.use(
    mockActivityService.startActivity.handler(async (opts) => {
      sentSimVersions.push(opts.input.simVersion);

      if (sentSimVersions.length === 1) {
        throw opts.errors.SIM_VERSION_UNKNOWN({ data: { currentSimVersion: null } });
      }

      const minted = await db.activityCollection.create({
        avatarID: viewer.avatar.id,
        scopeID: '0_0',
        scopeType: 'world_map_node',
        status: 'active',
      });

      return minted;
    }),
  );

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(sentSimVersions).toStrictEqual(['engine_hash_baked', undefined]);

  invariant(result.kind === 'started', 'expected a started status');
});

test('it settles a start rejected as SIM_VERSION_UNKNOWN as failed with no rejection once the registry-current retry also comes back unknown', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.SIM_VERSION_UNKNOWN({ data: { currentSimVersion: null } });
    }),
  );

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ kind: 'failed' });
});

test('it reports no worker fault for a start rejected as SIM_VERSION_EXPIRED', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.SIM_VERSION_EXPIRED({ data: { currentSimVersion: null } });
    }),
  );

  await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(recorded).toStrictEqual([]);
});

test('it reports no worker fault for a start rejected because the avatar is not active', async () => {
  const previousHandle = sentryHandle.current;
  const recorded: Array<Readonly<ErrorEvent>> = [];

  onTestFinished(() => {
    sentryHandle.current = previousHandle;
  });

  await startErrorReporting('https://testpublickey@o0.ingest.sentry.io/1', {
    beforeSend: (event) => {
      recorded.push(event);

      return null;
    },
    disableDefaultIntegrations: true,
  });

  const viewer = await createViewer();
  const otherAvatar = await db.avatarCollection.create({ userID: viewer.user.id });
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({ client: ctx.client, submitter: createStubSubmitter() });

  await handleStartActivityMessage(context, {
    avatarID: otherAvatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(recorded).toStrictEqual([]);
});

test('it starts locally from cached inputs and persists the row durably when offline', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_offline', submitter });

  context.setSimulation(createSimulation());
  context.updateConnectivity(false);

  const seed = createMockNodeSeed({
    avatarID: 'avatar_offline_start',
    encounterNode: { difficulty: 1 },
    genesisSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa6072',
    nodeID: '2_1',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 3, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const result = await handleStartActivityMessage(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
  });

  invariant(result.kind === 'started', 'expected a started status');

  expect(context.getSimulation().activity?.id).toBe(result.activity.id);
  expect(context.getActivity()?.id).toBe(result.activity.id);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: result.activity.id,
    appendedHead: 0,
    lastHash: result.activity.lastHash,
    startChainIndex: 0,
  });

  const persisted = await readOfflineStartRow(result.activity.id);

  expect(persisted).toStrictEqual(result.activity);

  const minted = db.activityCollection.findFirst((q) => q.where({ id: result.activity.id }));

  expect(minted).toBeUndefined();
});

test('it answers failed and persists nothing when offline and the scope was never cached', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  context.updateConnectivity(false);

  const result = await handleStartActivityMessage(context, {
    avatarID: 'avatar_offline_never_cached',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ kind: 'failed' });
  expect(context.getSimulation().activity).toBeNull();

  const rows = await readAllOfflineStartRows();

  expect(rows).toStrictEqual([]);
});

test('it answers failed and persists nothing when offline and no start stamps are cached', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  context.updateConnectivity(false);

  const seed = createMockNodeSeed({ avatarID: 'avatar_offline_no_stamps', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);

  const result = await handleStartActivityMessage(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ kind: 'failed' });

  const rows = await readAllOfflineStartRows();

  expect(rows).toStrictEqual([]);
});

test('it answers failed and persists nothing when offline and the build carries no bundled engine hash', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  context.updateConnectivity(false);

  const seed = createMockNodeSeed({ avatarID: 'avatar_offline_no_hash', nodeID: '1_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  const result = await handleStartActivityMessage(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ kind: 'failed' });

  const rows = await readAllOfflineStartRows();

  expect(rows).toStrictEqual([]);
});

test('it still starts through the service when connectivity reads online, even with offline start inputs cached', async () => {
  const viewer = await createViewer();
  const ctx = await setupTest({ userID: viewer.user.id });

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_online',
    client: ctx.client,
    submitter: createStubSubmitter(),
  });

  context.setSimulation(createSimulation());

  const seed = createMockNodeSeed({ avatarID: viewer.avatar.id, nodeID: '0_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  const result = await handleStartActivityMessage(context, {
    avatarID: viewer.avatar.id,
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  invariant(result.kind === 'started', 'expected a started status');

  const minted = db.activityCollection.findFirst((q) => q.where({ id: result.activity.id }));

  expect(minted).toBeDefined();

  const offlineRow = await readOfflineStartRow(result.activity.id);

  expect(offlineRow).toBeUndefined();
});

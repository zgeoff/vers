import { expect, mock, onTestFinished, test } from 'bun:test';
import type { ErrorEvent } from '@sentry/browser';
import {
  createMockActivityData,
  createMockContentDocument,
} from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import invariant from 'tiny-invariant';
import { writeContentDocumentCache } from '../content/write-content-document-cache';
import { server } from '../mocks/node';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { readAllStartRows } from '../submission/read-all-start-rows';
import { readStartRow } from '../submission/read-start-row';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { handleStartActivityMessage } from './handle-start-activity-message';
import { sentryHandle } from './sentry-handle';
import { startErrorReporting } from './start-error-reporting';

test('it mints a row locally, installs it, and persists the pending root', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1', submitter });

  context.setSimulation(createSimulation());

  const seed = createMockNodeSeed({
    avatarID: 'avatar_fresh_start',
    encounterNode: { difficulty: 1 },
    nodeID: '0_0',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

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
    avatarID: seed.avatarID,
    lastHash: result.activity.lastHash,
    scopeID: seed.nodeID,
    startChainIndex: 0,
  });

  const persisted = await readStartRow(result.activity.id);

  expect(persisted).toStrictEqual(result.activity);

  const mintedServerSide = db.activityCollection.findMany((q) =>
    q.where({ avatarID: seed.avatarID }),
  );

  expect(mintedServerSide).toStrictEqual([]);
});

test('it never calls the activity service to start', async () => {
  server.use(
    mockActivityService.startActivity.handler(() => {
      throw new Error('the local mint path must never call startActivity');
    }),
  );

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_1',
    submitter: createStubSubmitter(),
  });

  const seed = createMockNodeSeed({
    avatarID: 'avatar_no_rpc',
    encounterNode: { difficulty: 1 },
    nodeID: '0_0',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const result = await handleStartActivityMessage(context, {
    avatarID: seed.avatarID,
    scopeID: seed.nodeID,
    scopeType: 'world_map_node',
  });

  expect(result.kind).toBe('started');
});

test('it answers attached without re-minting when the request already matches the live scope', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ submitter });
  const simulation = createSimulation();

  const running = createMockActivityData({
    avatarID: 'avatar_same_scope',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: running.id }));
  context.setSimulation(simulation);
  context.setActivity(running);

  const result = await handleStartActivityMessage(context, {
    avatarID: 'avatar_same_scope',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ activityID: running.id, kind: 'attached' });
  expect(submitter.registerActivity).not.toHaveBeenCalled();

  const rows = await readAllStartRows();

  expect(rows).toStrictEqual([]);
});

test('it stops the live run and starts the new one when the request names a different scope', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_2', submitter });
  const simulation = createSimulation();

  const previous = createMockActivityData({
    avatarID: 'avatar_switch_scope',
    id: 'act_previous',
    scopeID: '5_0',
    scopeType: 'world_map_node',
  });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: previous.id }));
  context.setSimulation(simulation);
  context.setActivity(previous);

  const seed = createMockNodeSeed({
    avatarID: 'avatar_switch_scope',
    encounterNode: { difficulty: 1 },
    nodeID: '0_0',
  });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  await writeContentDocumentCache(
    createMockContentDocument({ contentVersion: seed.contentVersion }),
  );

  const result = await handleStartActivityMessage(context, {
    avatarID: 'avatar_switch_scope',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  invariant(result.kind === 'started', 'expected a started status');

  expect(result.activity.scopeID).toBe('0_0');
  expect(submitter.flushNow).toHaveBeenCalledExactlyOnceWith(previous.id);
  expect(context.getActivity()?.id).toBe(result.activity.id);
  expect(context.getSimulation().activity?.id).toBe(result.activity.id);
});

test('it answers failed and persists nothing when the scope was never cached', async () => {
  const context = createStubWorkerContext({ submitter: createStubSubmitter() });

  const result = await handleStartActivityMessage(context, {
    avatarID: 'avatar_never_cached',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ kind: 'failed' });
  expect(context.getSimulation().activity).toBeNull();

  const rows = await readAllStartRows();

  expect(rows).toStrictEqual([]);
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

  expect(result).toStrictEqual({ kind: 'failed' });
  expect(recorded).toStrictEqual([]);

  const rows = await readAllStartRows();

  expect(rows).toStrictEqual([]);
});

test('it abandons a superseded different-scope switch without touching the live run', async () => {
  const flushEffect = { current: () => {} };

  const submitter: CheckpointSubmitter = {
    ...createStubSubmitter(),
    flushNow: mock(() => {
      flushEffect.current();

      return Promise.resolve();
    }),
  };

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_3', submitter });
  const simulation = createSimulation();

  const previous = createMockActivityData({
    avatarID: 'avatar_superseded_switch',
    id: 'act_superseded_previous',
    scopeID: '5_0',
    scopeType: 'world_map_node',
  });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: previous.id }));
  context.setSimulation(simulation);
  context.setActivity(previous);

  const seed = createMockNodeSeed({ avatarID: 'avatar_superseded_switch', nodeID: '0_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  // a fresher selection claims the runtime while the different-scope switch is mid-flush
  flushEffect.current = () => {
    context.setStartToken('a-fresher-token');
  };

  const result = await handleStartActivityMessage(context, {
    avatarID: 'avatar_superseded_switch',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ kind: 'failed' });
  expect(context.getActivity()?.id).toBe(previous.id);
});

test('it stops a freshly minted row back durably when a stop lands mid-switch', async () => {
  const stopEffect = { current: () => {} };

  const submitter: CheckpointSubmitter = {
    ...createStubSubmitter(),
    flushNow: mock(() => {
      stopEffect.current();

      return Promise.resolve();
    }),
  };

  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_4', submitter });
  const simulation = createSimulation();

  const previous = createMockActivityData({
    avatarID: 'avatar_stop_mid_switch',
    id: 'act_stop_mid_switch_previous',
    scopeID: '5_0',
    scopeType: 'world_map_node',
  });

  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: previous.id }));
  context.setSimulation(simulation);
  context.setActivity(previous);

  const seed = createMockNodeSeed({ avatarID: 'avatar_stop_mid_switch', nodeID: '0_0' });

  await writeNodeSeeds(seed.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  // the player stops mid-flush: the stop scope advances, so the fresh mint the switch was about
  // to install must be stopped back durably instead
  stopEffect.current = () => {
    context.advanceStopScope();
  };

  const result = await handleStartActivityMessage(context, {
    avatarID: 'avatar_stop_mid_switch',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  });

  expect(result).toStrictEqual({ kind: 'failed' });
  expect(context.getActivity()?.id).toBe(previous.id);
  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

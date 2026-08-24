import { expect, test } from 'bun:test';
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
import { readActivityStart } from '../submission/read-activity-start';
import { readAllActivityStarts } from '../submission/read-all-activity-starts';
import type { NodeSeed } from '../submission/types';
import { writeNodeSeeds } from '../submission/write-node-seeds';
import { writeStartStamps } from '../submission/write-start-stamps';
import { createStubSubmitter } from '../test-utils/create-stub-submitter';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { createMockNodeSeed } from '../test-utils/factories/create-mock-node-seed';
import { buildDeferred } from './build-deferred';
import { runContinuation } from './run-continuation';

interface SeedCachesOptions {
  readonly avatarID: string;
  readonly cacheDocument?: boolean;
}

/**
 * Caches every input a local mint reads — the scope's node seed, the account's stamps, and the
 * content document the install loads. `cacheDocument: false` leaves the document to the service, so
 * a test can interleave with the one await that remains past the mint.
 */
async function setupTest(options: Readonly<SeedCachesOptions>): Promise<NodeSeed> {
  const seed = createMockNodeSeed({
    avatarID: options.avatarID,
    encounterNode: { difficulty: 1 },
    nodeID: '0_0',
  });

  await writeNodeSeeds(options.avatarID, [seed]);
  await writeStartStamps({ keyVersion: 1, secretRef: 'worldmap', secretVersion: 1 });

  if (options.cacheDocument !== false) {
    await writeContentDocumentCache(
      createMockContentDocument({ contentVersion: seed.contentVersion }),
    );
  }

  return seed;
}

test('it mints the next row locally, installs it, and registers from a zero cursor', async () => {
  const avatarID = 'avatar_continue';

  const seed = await setupTest({ avatarID });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1', submitter });
  const simulation = createSimulation();
  const terminal = createMockActivityData({ avatarID, scopeID: seed.nodeID });

  context.setSimulation(simulation);
  context.setActivity(terminal);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: terminal.id }));

  await runContinuation(context, simulation, terminal);

  const minted = context.getActivity();

  invariant(minted !== null, 'expected the continuation to install a fresh row');

  expect(minted.id).not.toBe(terminal.id);
  expect(minted.scopeID).toBe(terminal.scopeID);
  expect(simulation.activity?.id).toBe(minted.id);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: minted.id,
    appendedHead: 0,
    avatarID: minted.avatarID,
    lastHash: minted.startHash,
    scopeID: minted.scopeID,
    startChainIndex: minted.startChainIndex,
  });

  // the server authors nothing on the request path — the row reaches it through the ingest
  const mintedServerSide = db.activityCollection.findMany((q) => q.where({ avatarID }));

  expect(mintedServerSide).toStrictEqual([]);
});

test('it persists the minted row durably before installing it', async () => {
  const avatarID = 'avatar_durable';

  const seed = await setupTest({ avatarID });

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_1',
    submitter: createStubSubmitter(),
  });

  const simulation = createSimulation();
  const terminal = createMockActivityData({ avatarID, scopeID: seed.nodeID });

  context.setSimulation(simulation);
  context.setActivity(terminal);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: terminal.id }));

  await runContinuation(context, simulation, terminal);

  const minted = context.getActivity();

  invariant(minted !== null, 'expected the continuation to install a fresh row');

  const persisted = await readActivityStart(minted.id);

  expect(persisted).toStrictEqual(minted);
});

test('it stamps the terminal row it succeeds as the predecessor and keys the start on it', async () => {
  const avatarID = 'avatar_predecessor';

  const seed = await setupTest({ avatarID });

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_1',
    submitter: createStubSubmitter(),
  });

  const simulation = createSimulation();
  const terminal = createMockActivityData({ avatarID, scopeID: seed.nodeID });

  context.setSimulation(simulation);
  context.setActivity(terminal);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: terminal.id }));

  await runContinuation(context, simulation, terminal);

  const minted = context.getActivity();

  invariant(minted !== null, 'expected the continuation to install a fresh row');

  expect(minted.predecessorActivityID).toBe(terminal.id);
  expect(minted.startKey).toBe(`continue_${terminal.id}`);
});

test("it anchors the next row at the scope's cached anchor", async () => {
  const avatarID = 'avatar_anchor';

  const seed = await setupTest({ avatarID });

  const context = createStubWorkerContext({
    bundledEngineHash: 'engine_hash_1',
    submitter: createStubSubmitter(),
  });

  const simulation = createSimulation();
  const terminal = createMockActivityData({ avatarID, scopeID: seed.nodeID });

  context.setSimulation(simulation);
  context.setActivity(terminal);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: terminal.id }));

  await runContinuation(context, simulation, terminal);

  const minted = context.getActivity();

  invariant(minted !== null, 'expected the continuation to install a fresh row');

  expect(minted.seed).toBe(seed.anchor.nextSeed);
  expect(minted.startChainIndex).toBe(seed.anchor.chainIndex);
});

test('it resets the runtime to idle when an input the mint needs was never cached', async () => {
  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1', submitter });
  const simulation = createSimulation();

  // no node seed cached for this avatar, so no local mint is possible
  const terminal = createMockActivityData({ avatarID: 'avatar_uncached' });

  context.setSimulation(simulation);
  context.setActivity(terminal);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: terminal.id }));

  await runContinuation(context, simulation, terminal);

  expect(context.getActivity()).toBeNull();
  expect(simulation.activity).toBeNull();
  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

test('it returns untouched when the runtime moved on before its turn ran', async () => {
  const avatarID = 'avatar_stale';

  const seed = await setupTest({ avatarID });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1', submitter });
  const simulation = createSimulation();
  const replacement = createSimulation();
  const terminal = createMockActivityData({ avatarID, scopeID: seed.nodeID });

  context.setSimulation(replacement);
  context.setActivity(terminal);

  await runContinuation(context, simulation, terminal);

  expect(context.getSimulation()).toBe(replacement);
  expect(submitter.registerActivity).not.toHaveBeenCalled();
});

test('it leaves the minted row durable for a later drain when a stop cancels the content load', async () => {
  const avatarID = 'avatar_stopped';

  const seed = await setupTest({ avatarID, cacheDocument: false });

  const submitter = createStubSubmitter();
  const context = createStubWorkerContext({ bundledEngineHash: 'engine_hash_1', submitter });
  const simulation = createSimulation();
  const terminal = createMockActivityData({ avatarID, scopeID: seed.nodeID });

  context.setSimulation(simulation);
  context.setActivity(terminal);
  simulation.startActivity(createMockAvatarData(), createMockActivityInput({ id: terminal.id }));

  // the content load is the one await left past the mint; the handler parks there so the stop
  // lands inside it, exactly as a player stop racing an install does
  const reachedLoad = buildDeferred<void>();
  const releaseLoad = buildDeferred<void>();

  server.use(
    mockActivityService.getContentDocument.handler(async () => {
      reachedLoad.resolve();

      await releaseLoad.promise;

      return createMockContentDocument({ contentVersion: seed.contentVersion });
    }),
  );

  const flow = runContinuation(context, simulation, terminal);

  await reachedLoad.promise;

  context.advanceStopScope();
  releaseLoad.resolve();

  // the stop scope composes into the cancel signal, so the load is cancelled rather than resumed
  const settled = await flow.then(
    () => null,
    (error: unknown) => error,
  );

  expect(settled).toMatchObject({ name: 'AbortError' });
  expect(submitter.registerActivity).not.toHaveBeenCalled();

  // the row was written before the install, so the next reconnect's drain still delivers it
  const starts = await readAllActivityStarts();

  expect(starts.filter((row) => row.avatarID === avatarID)).toHaveLength(1);
});

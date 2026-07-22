import { expect, onTestFinished, test } from 'bun:test';
import type { ActivityCheckpoint } from '@vers/contract-replay';
import { createMockReplaySegmentInput } from '@vers/contract-replay/test-utils';
import { buildStateFromSeed } from '@vers/game-utils';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { createSimVersionRow } from '@vers/sim-registry/test-utils';
import { http, passthrough } from 'msw';
import { server } from '../mocks/server';
import { createRemoteReplayProvider } from '../test-utils/create-remote-replay-provider';
import { runReplaySegment } from './run-replay-segment';

const DETERMINISTIC_INPUT = createMockReplaySegmentInput({
  simVersion: 'test-engine-hash',
  activity: {
    difficulty: 1,
    encounter: {
      waves: [
        Array.from({ length: 6 }, () => ({
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        })),
        Array.from({ length: 6 }, () => ({
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        })),
        Array.from({ length: 3 }, () => ({
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        })),
        Array.from({ length: 4 }, () => ({
          level: 1,
          life: 30,
          name: 'Test Enemy',
          primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
          xp: 10,
        })),
      ],
    },
    failureAction: 'retry',
    id: 'world_map_encounter_1',
    name: 'World Map Encounter',
    seed: buildStateFromSeed(3_047_525_658),
    type: 'world_map_encounter',
  },
  avatar: {
    id: 'avatar_1',
    level: 1,
    life: 200,
    name: 'Test Avatar',
    paperdoll: {
      mainHand: {
        id: 'weapon_1',
        maxDamage: 20,
        minDamage: 10,
        name: 'Bloodthirst Blade, Bastard Sword',
        speed: 0.8,
      },
    },
    xp: 0,
  },
  duration: 80_000,
});

/**
 * Matches the recorded fixture `replay-segment.test.ts` commits to for the same deterministic
 * scenario.
 */
const EXPECTED_CHECKPOINTS: Array<ActivityCheckpoint> = [
  {
    nextSeed: 'ffffffff4a5a72e5b5a58d1a00000000',
    rewards: { xp: 0 },
    rewardSlots: [],
    seed: 'ffffffff4a5a72e5b5a58d1a00000000',
    time: 0,
    type: 'started',
  },
  {
    nextSeed: '5468a77edf984ec079995dfd698938b2',
    rewards: { xp: 60 },
    rewardSlots: [
      { context: { nodeTier: 1 }, ordinal: 0 },
      { context: { nodeTier: 1 }, ordinal: 1 },
      { context: { nodeTier: 1 }, ordinal: 2 },
      { context: { nodeTier: 1 }, ordinal: 3 },
      { context: { nodeTier: 1 }, ordinal: 4 },
      { context: { nodeTier: 1 }, ordinal: 5 },
    ],
    time: 21_250,
    type: 'progress',
  },
  {
    levelUp: { from: 1, to: 2 },
    nextSeed: '86c008c1cb5d97968d4554750eefc5d4',
    rewards: { xp: 60 },
    rewardSlots: [
      { context: { nodeTier: 1 }, ordinal: 0 },
      { context: { nodeTier: 1 }, ordinal: 1 },
      { context: { nodeTier: 1 }, ordinal: 2 },
      { context: { nodeTier: 1 }, ordinal: 3 },
      { context: { nodeTier: 1 }, ordinal: 4 },
      { context: { nodeTier: 1 }, ordinal: 5 },
    ],
    time: 38_750,
    type: 'progress',
  },
  {
    nextSeed: 'f8e88eca342f7fe8bd8ab666f4b8bb62',
    rewards: { xp: 30 },
    rewardSlots: [
      { context: { nodeTier: 1 }, ordinal: 0 },
      { context: { nodeTier: 1 }, ordinal: 1 },
      { context: { nodeTier: 1 }, ordinal: 2 },
    ],
    time: 48_750,
    type: 'progress',
  },
  {
    nextSeed: '664be6d955fc249bfe89a1dbcdfd99cc',
    rewards: { xp: 40 },
    rewardSlots: [
      { context: { nodeTier: 1 }, ordinal: 0 },
      { context: { nodeTier: 1 }, ordinal: 1 },
      { context: { nodeTier: 1 }, ordinal: 2 },
      { context: { nodeTier: 1 }, ordinal: 3 },
    ],
    time: 61_250,
    type: 'progress',
  },
  {
    nextSeed: '664be6d955fc249bfe89a1dbcdfd99cc',
    rewards: { xp: 215 },
    rewardSlots: [],
    time: 61_250,
    type: 'completed',
  },
  {
    nextSeed: '664be6d955fc249bfe89a1dbcdfd99cc',
    rewards: { xp: 0 },
    rewardSlots: [],
    seed: '664be6d955fc249bfe89a1dbcdfd99cc',
    time: 0,
    type: 'started',
  },
];

async function setupTest() {
  const db = await createTestDB();
  const keyPair = await getTestServiceKeyPair();

  return {
    db: db.db,
    privateKey: keyPair.privateKey,
    [Symbol.asyncDispose]: db[Symbol.asyncDispose],
  };
}

test('it replays in-process when the job matches this deploy’s baked hash', async () => {
  await using ctx = await setupTest();

  const outcome = await runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: DETERMINISTIC_INPUT.simVersion },
    DETERMINISTIC_INPUT,
  );

  expect(outcome).toStrictEqual({
    kind: 'replayed',
    output: { checkpoints: EXPECTED_CHECKPOINTS, elapsed: 80_000 },
  });
});

test('it reports unknownVersion when the registry has no row for the stamped hash', async () => {
  await using ctx = await setupTest();

  const job = createMockReplaySegmentInput({ simVersion: 'never-registered-hash' });

  const outcome = await runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-deploy-hash' },
    job,
  );

  expect(outcome).toStrictEqual({ kind: 'unknownVersion' });
});

test('it reports expired for a pruned registry row', async () => {
  await using ctx = await setupTest();

  const job = createMockReplaySegmentInput({ simVersion: 'pruned-hash' });

  await createSimVersionRow(ctx.db, { engineHash: 'pruned-hash', status: 'pruned' });

  const outcome = await runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-deploy-hash' },
    job,
  );

  expect(outcome).toStrictEqual({ kind: 'expired' });
});

test('it reports expired for a registry row past its retention deadline', async () => {
  await using ctx = await setupTest();

  const job = createMockReplaySegmentInput({ simVersion: 'past-retention-hash' });

  await createSimVersionRow(ctx.db, {
    engineHash: 'past-retention-hash',
    retainedUntil: new Date(Date.now() - 60_000),
    status: 'active',
  });

  const outcome = await runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-deploy-hash' },
    job,
  );

  expect(outcome).toStrictEqual({ kind: 'expired' });
});

test('it round-trips a remote dispatch over real HTTP with real s2s auth', async () => {
  await using ctx = await setupTest();

  const remote = await createRemoteReplayProvider(DETERMINISTIC_INPUT.simVersion);

  await createSimVersionRow(ctx.db, {
    engineHash: DETERMINISTIC_INPUT.simVersion,
    providerUrl: remote.url,
    status: 'active',
  });

  const outcome = await runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-dispatcher-hash' },
    DETERMINISTIC_INPUT,
  );

  expect(outcome).toStrictEqual({
    kind: 'replayed',
    output: { checkpoints: EXPECTED_CHECKPOINTS, elapsed: 80_000 },
  });
});

test('it attaches a traceparent to a remote dispatch', async () => {
  await using ctx = await setupTest();

  const remote = await createRemoteReplayProvider(DETERMINISTIC_INPUT.simVersion);

  await createSimVersionRow(ctx.db, {
    engineHash: DETERMINISTIC_INPUT.simVersion,
    providerUrl: remote.url,
    status: 'active',
  });

  const observedTraceparents: Array<string | null> = [];

  server.use(
    http.post(`${remote.url}/rpc/replaySegment`, (info) => {
      observedTraceparents.push(info.request.headers.get('traceparent'));

      return passthrough();
    }),
  );

  const response = await runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-dispatcher-hash' },
    DETERMINISTIC_INPUT,
  );

  expect(response).toStrictEqual({
    kind: 'replayed',
    output: { checkpoints: EXPECTED_CHECKPOINTS, elapsed: 80_000 },
  });

  const [observedTraceparent] = observedTraceparents;

  expect(observedTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
});

test('it reports providerUnavailable when the provider never responds', async () => {
  await using ctx = await setupTest();

  const providerServer = Bun.serve({
    // Never resolves on its own; settles only once the client's own abort reaches the server, so
    // `stop(true)` in teardown doesn't hang waiting on a handler stuck forever.
    fetch: (request) =>
      new Promise<Response>((resolve) => {
        request.signal.addEventListener('abort', () => {
          resolve(new Response(null, { status: 499 }));
        });
      }),
    port: 0,
  });

  onTestFinished(async () => {
    await providerServer.stop(true);
  });

  const job = createMockReplaySegmentInput({ simVersion: 'hung-provider-hash' });

  await createSimVersionRow(ctx.db, {
    engineHash: job.simVersion,
    providerUrl: `http://localhost:${providerServer.port}`,
    status: 'active',
  });

  const outcome = await runReplaySegment(
    {
      db: ctx.db,
      privateKey: ctx.privateKey,
      simVersion: 'this-dispatcher-hash',
      timeoutMs: 50,
    },
    job,
  );

  expect(outcome).toStrictEqual({ kind: 'providerUnavailable' });
});

test('it reports providerUnavailable when the provider connection is refused', async () => {
  await using ctx = await setupTest();

  const job = createMockReplaySegmentInput({ simVersion: 'unreachable-provider-hash' });

  await createSimVersionRow(ctx.db, {
    engineHash: job.simVersion,
    providerUrl: 'http://127.0.0.1:1',
    status: 'active',
  });

  const outcome = await runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-dispatcher-hash' },
    job,
  );

  expect(outcome).toStrictEqual({ kind: 'providerUnavailable' });
});

test('it reports providerUnavailable when the provider answers with a proxy-style 5xx', async () => {
  await using ctx = await setupTest();

  const providerServer = Bun.serve({
    fetch: () => new Response('<html><body>502 Bad Gateway</body></html>', { status: 503 }),
    port: 0,
  });

  onTestFinished(async () => {
    await providerServer.stop(true);
  });

  const job = createMockReplaySegmentInput({ simVersion: 'half-booted-provider-hash' });

  await createSimVersionRow(ctx.db, {
    engineHash: job.simVersion,
    providerUrl: `http://localhost:${providerServer.port}`,
    status: 'active',
  });

  const outcome = await runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-dispatcher-hash' },
    job,
  );

  expect(outcome).toStrictEqual({ kind: 'providerUnavailable' });
});

test('it lets a SIM_VERSION_MISMATCH from a resolved provider throw as a misroute', async () => {
  await using ctx = await setupTest();

  const remote = await createRemoteReplayProvider('providers-actual-hash');

  const job = createMockReplaySegmentInput({ simVersion: 'stamped-hash-the-provider-disowns' });

  await createSimVersionRow(ctx.db, {
    engineHash: job.simVersion,
    providerUrl: remote.url,
    status: 'active',
  });

  const outcome = runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-dispatcher-hash' },
    job,
  );

  expect(outcome).rejects.toMatchObject({ code: 'SIM_VERSION_MISMATCH' });
});

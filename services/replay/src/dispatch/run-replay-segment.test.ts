import { expect, onTestFinished, test } from 'bun:test';
import type { ActivityCheckpoint } from '@vers/contract-replay';
import { buildStateFromSeed } from '@vers/game-utils';
import { createTestDB, getTestServiceKeyPair } from '@vers/service-test-utils/bun';
import { updateEnv } from '@vers/test-utils/bun';
import { createReplayService } from '../create-replay-service';
import { createSimVersionRow } from '../test-utils/create-sim-version-row';
import { createMockReplaySegmentInput } from '../test-utils/factories/create-mock-replay-segment-input';
import { runReplaySegment } from './run-replay-segment';

const DETERMINISTIC_INPUT = createMockReplaySegmentInput({
  activity: {
    difficulty: 1,
    enemies: [
      {
        level: 1,
        life: 30,
        name: 'Test Enemy',
        primaryAttack: { maxDamage: 3, minDamage: 1, speed: 0.5 },
        xp: 10,
      },
    ],
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
    nextSeed: '63298078c2177576c07e0321584c2a05',
    rewards: { xp: 0 },
    seed: '63298078c2177576c07e0321584c2a05',
    time: 0,
    type: 'started',
  },
  {
    nextSeed: '20c0dac3c8da96ee1a82332c38c2e8ae',
    rewards: { xp: 60 },
    time: 16_300,
    type: 'progress',
  },
  {
    levelUp: { from: 1, to: 2 },
    nextSeed: '651b7bac24e8282ac2345557ee733dc5',
    rewards: { xp: 60 },
    time: 33_800,
    type: 'progress',
  },
  {
    nextSeed: '183a8b662f0c22f40b637a9f83c410ca',
    rewards: { xp: 30 },
    time: 43_800,
    type: 'progress',
  },
  {
    nextSeed: '0d1c5f2ed8a45260129c426ab502cbb3',
    rewards: { xp: 40 },
    time: 56_300,
    type: 'progress',
  },
  {
    nextSeed: '0d1c5f2ed8a45260129c426ab502cbb3',
    rewards: { xp: 215 },
    time: 56_300,
    type: 'completed',
  },
  {
    nextSeed: '664be6d955fc249bfe89a1dbcdfd99cc',
    rewards: { xp: 0 },
    seed: '664be6d955fc249bfe89a1dbcdfd99cc',
    time: 0,
    type: 'started',
  },
  {
    nextSeed: 'dd5a3353a7f6c0c6afcb296684176982',
    rewards: { xp: 40 },
    time: 13_800,
    type: 'progress',
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

/**
 * Boots a second replay instance baked with a different engine hash, listening on an ephemeral
 * port, so a remote dispatch has a real provider to round-trip against.
 */
async function setupRemoteProvider(engineHash: string) {
  updateEnv('SIM_ENGINE_HASH', engineHash);

  const provider = await createReplayService();

  provider.listen(0);

  onTestFinished(() => provider.app.stop());

  const port = provider.app.server?.port;

  if (port === undefined) {
    throw new Error('provider service did not bind a port');
  }

  return `http://localhost:${port}`;
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

  const providerURL = await setupRemoteProvider(DETERMINISTIC_INPUT.simVersion);

  await createSimVersionRow(ctx.db, {
    engineHash: DETERMINISTIC_INPUT.simVersion,
    providerUrl: providerURL,
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

test('it lets a SIM_VERSION_MISMATCH from a resolved provider throw as a misroute', async () => {
  await using ctx = await setupTest();

  const providerURL = await setupRemoteProvider('providers-actual-hash');

  const job = createMockReplaySegmentInput({ simVersion: 'stamped-hash-the-provider-disowns' });

  await createSimVersionRow(ctx.db, {
    engineHash: job.simVersion,
    providerUrl: providerURL,
    status: 'active',
  });

  const outcome = runReplaySegment(
    { db: ctx.db, privateKey: ctx.privateKey, simVersion: 'this-dispatcher-hash' },
    job,
  );

  expect(outcome).rejects.toMatchObject({ code: 'SIM_VERSION_MISMATCH' });
});

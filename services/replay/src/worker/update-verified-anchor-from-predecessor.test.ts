import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { createTestDB } from '@vers/service-test-utils/bun';
import invariant from 'tiny-invariant';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { createMockReplaySegment } from '../test-utils/factories/create-mock-replay-segment';
import { updateVerifiedAnchorFromPredecessor } from './update-verified-anchor-from-predecessor';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it advances the chain verified anchor from a fully verified, stopped predecessor', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = fixture.checkpoints.length - 1;

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, verifiedHead: tailCount })
    .where('id', '=', fixture.activity.id)
    .execute();

  const tail = fixture.checkpoints[tailCount - 1];

  invariant(tail, 'the fixture always stores a checkpoint at the trimmed tail');

  const segment = createMockReplaySegment({
    activity: {
      avatarID: fixture.activity.avatarId,
      scopeID: fixture.activity.scopeId,
      scopeType: fixture.activity.scopeType,
      startChainIndex: tail.payload.chainIndex,
    },
    chain: {
      genesisSeed: fixture.chain.genesisSeed,
      verifiedChainIndex: fixture.chain.verifiedChainIndex,
      verifiedNextSeed: fixture.chain.verifiedNextSeed,
    },
  });

  const advance = await updateVerifiedAnchorFromPredecessor(ctx.db, segment);

  expect(advance).toStrictEqual({
    chainIndex: tail.payload.chainIndex,
    nextSeed: tail.payload.nextSeed,
  });

  const chain = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('scopeId', '=', fixture.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chain).toStrictEqual({
    verifiedChainIndex: tail.payload.chainIndex,
    verifiedNextSeed: tail.payload.nextSeed,
  });
});

test('it leaves the chain untouched when the target is not ahead of the verified anchor', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const segment = createMockReplaySegment({
    activity: {
      avatarID: fixture.activity.avatarId,
      scopeID: fixture.activity.scopeId,
      scopeType: fixture.activity.scopeType,
      startChainIndex: fixture.chain.verifiedChainIndex,
    },
    chain: {
      genesisSeed: fixture.chain.genesisSeed,
      verifiedChainIndex: fixture.chain.verifiedChainIndex,
      verifiedNextSeed: fixture.chain.verifiedNextSeed,
    },
  });

  const advance = await updateVerifiedAnchorFromPredecessor(ctx.db, segment);

  expect(advance).toBeUndefined();

  const chain = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('scopeId', '=', fixture.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chain).toStrictEqual({
    verifiedChainIndex: fixture.chain.verifiedChainIndex,
    verifiedNextSeed: fixture.chain.verifiedNextSeed,
  });
});

test('it leaves the chain untouched when no predecessor exists at the gap', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const segment = createMockReplaySegment({
    activity: {
      avatarID: fixture.activity.avatarId,
      scopeID: fixture.activity.scopeId,
      scopeType: fixture.activity.scopeType,
      startChainIndex: 999,
    },
    chain: {
      genesisSeed: fixture.chain.genesisSeed,
      verifiedChainIndex: fixture.chain.verifiedChainIndex,
      verifiedNextSeed: fixture.chain.verifiedNextSeed,
    },
  });

  const advance = await updateVerifiedAnchorFromPredecessor(ctx.db, segment);

  expect(advance).toBeUndefined();

  const chain = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', fixture.activity.avatarId)
    .where('scopeId', '=', fixture.activity.scopeId)
    .executeTakeFirstOrThrow();

  expect(chain).toStrictEqual({
    verifiedChainIndex: fixture.chain.verifiedChainIndex,
    verifiedNextSeed: fixture.chain.verifiedNextSeed,
  });
});

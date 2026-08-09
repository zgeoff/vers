import { expect, test } from 'bun:test';
import { buildStateFromSeed } from '@vers/game-utils';
import { createTestDB } from '@vers/service-test-utils/bun';
import invariant from 'tiny-invariant';
import { createHonestActivityFixture } from '../test-utils/create-honest-activity-fixture';
import { findVerifiedAnchorPredecessor } from './find-verified-anchor-predecessor';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it finds a fully verified, stopped predecessor rooted at the chain verified anchor', async () => {
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

  const predecessor = await findVerifiedAnchorPredecessor(ctx.db, {
    avatarID: fixture.activity.avatarId,
    scopeID: fixture.activity.scopeId,
    scopeType: fixture.activity.scopeType,
    verifiedChainIndex: fixture.chain.verifiedChainIndex,
  });

  const tail = fixture.checkpoints[tailCount - 1];

  invariant(tail, 'the fixture always stores a checkpoint at the trimmed tail');

  expect(predecessor).toStrictEqual({
    chainIndex: tail.payload.chainIndex,
    nextSeed: tail.payload.nextSeed,
  });
});

test('it finds a fully verified, capped predecessor rooted at the chain verified anchor', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'capped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = fixture.checkpoints.length - 1;

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, verifiedHead: tailCount })
    .where('id', '=', fixture.activity.id)
    .execute();

  const predecessor = await findVerifiedAnchorPredecessor(ctx.db, {
    avatarID: fixture.activity.avatarId,
    scopeID: fixture.activity.scopeId,
    scopeType: fixture.activity.scopeType,
    verifiedChainIndex: fixture.chain.verifiedChainIndex,
  });

  const tail = fixture.checkpoints[tailCount - 1];

  invariant(tail, 'the fixture always stores a checkpoint at the trimmed tail');

  expect(predecessor).toStrictEqual({
    chainIndex: tail.payload.chainIndex,
    nextSeed: tail.payload.nextSeed,
  });
});

test('it finds no predecessor when the activity at that position is still active', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const tailCount = fixture.checkpoints.length - 1;

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, verifiedHead: tailCount })
    .where('id', '=', fixture.activity.id)
    .execute();

  const predecessor = await findVerifiedAnchorPredecessor(ctx.db, {
    avatarID: fixture.activity.avatarId,
    scopeID: fixture.activity.scopeId,
    scopeType: fixture.activity.scopeType,
    verifiedChainIndex: fixture.chain.verifiedChainIndex,
  });

  expect(predecessor).toBeUndefined();
});

test('it finds no predecessor when the activity has not fully verified', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 80_000,
    seed: buildStateFromSeed(3_047_525_658),
  });

  const predecessor = await findVerifiedAnchorPredecessor(ctx.db, {
    avatarID: fixture.activity.avatarId,
    scopeID: fixture.activity.scopeId,
    scopeType: fixture.activity.scopeType,
    verifiedChainIndex: fixture.chain.verifiedChainIndex,
  });

  expect(predecessor).toBeUndefined();
});

test('it finds no predecessor whose tail checkpoint is the Started one', async () => {
  await using ctx = await setupTest();

  const fixture = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 1,
    seed: buildStateFromSeed(3_047_525_658),
  });

  expect(fixture.checkpoints).toHaveLength(1);
  expect(fixture.checkpoints[0]?.payload.type).toBe('started');

  await ctx.db
    .updateTable('activities')
    .set({ verifiedHead: fixture.activity.appendedHead })
    .where('id', '=', fixture.activity.id)
    .execute();

  const predecessor = await findVerifiedAnchorPredecessor(ctx.db, {
    avatarID: fixture.activity.avatarId,
    scopeID: fixture.activity.scopeId,
    scopeType: fixture.activity.scopeType,
    verifiedChainIndex: fixture.chain.verifiedChainIndex,
  });

  expect(predecessor).toBeUndefined();
});

test('it finds the consuming predecessor when a Started-only stopped activity shares its startChainIndex', async () => {
  await using ctx = await setupTest();

  const startedOnly = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 1,
    seed: buildStateFromSeed(3_047_525_658),
  });

  expect(startedOnly.checkpoints).toHaveLength(1);
  expect(startedOnly.checkpoints[0]?.payload.type).toBe('started');

  await ctx.db
    .updateTable('activities')
    .set({ verifiedHead: startedOnly.activity.appendedHead })
    .where('id', '=', startedOnly.activity.id)
    .execute();

  const consuming = await createHonestActivityFixture(ctx.db, {
    activity: { status: 'stopped' },
    duration: 80_000,
    rootChain: startedOnly.chain,
    seed: buildStateFromSeed(3_047_525_658),
    startChainIndex: startedOnly.activity.startChainIndex,
  });

  const tailCount = consuming.checkpoints.length - 1;

  await ctx.db
    .updateTable('activities')
    .set({ appendedHead: tailCount, verifiedHead: tailCount })
    .where('id', '=', consuming.activity.id)
    .execute();

  const predecessor = await findVerifiedAnchorPredecessor(ctx.db, {
    avatarID: consuming.activity.avatarId,
    scopeID: consuming.activity.scopeId,
    scopeType: consuming.activity.scopeType,
    verifiedChainIndex: consuming.chain.verifiedChainIndex,
  });

  const tail = consuming.checkpoints[tailCount - 1];

  invariant(tail, 'the fixture always stores a checkpoint at the trimmed tail');

  expect(predecessor).toStrictEqual({
    chainIndex: tail.payload.chainIndex,
    nextSeed: tail.payload.nextSeed,
  });
});

test('it finds no predecessor rooted at a different chain position', async () => {
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

  const predecessor = await findVerifiedAnchorPredecessor(ctx.db, {
    avatarID: fixture.activity.avatarId,
    scopeID: fixture.activity.scopeId,
    scopeType: fixture.activity.scopeType,
    verifiedChainIndex: fixture.chain.verifiedChainIndex + 5,
  });

  expect(predecessor).toBeUndefined();
});

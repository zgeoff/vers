import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { createChainRow } from '../test-utils/create-chain-row';
import { updateVerifiedChainAnchor } from './update-verified-chain-anchor';

async function setupTest() {
  const db = await createTestDB();

  return { db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it advances the chain row verified anchor', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);

  const chain = await createChainRow(ctx.db, {
    avatarId: avatar.id,
    verifiedChainIndex: 2,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  await updateVerifiedChainAnchor(ctx.db, {
    avatarID: avatar.id,
    chainIndex: 5,
    nextSeed: 'bb'.repeat(16),
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updated = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', avatar.id)
    .where('scopeId', '=', chain.scopeId)
    .executeTakeFirstOrThrow();

  expect(updated).toStrictEqual({ verifiedChainIndex: 5, verifiedNextSeed: 'bb'.repeat(16) });
});

test('it leaves a stale advance untouched', async () => {
  await using ctx = await setupTest();

  const avatar = await createAvatarRow(ctx.db);

  const chain = await createChainRow(ctx.db, {
    avatarId: avatar.id,
    verifiedChainIndex: 10,
    verifiedNextSeed: 'aa'.repeat(16),
  });

  await updateVerifiedChainAnchor(ctx.db, {
    avatarID: avatar.id,
    chainIndex: 4,
    nextSeed: 'bb'.repeat(16),
    scopeID: chain.scopeId,
    scopeType: chain.scopeType,
  });

  const updated = await ctx.db
    .selectFrom('activityChains')
    .select(['verifiedChainIndex', 'verifiedNextSeed'])
    .where('avatarId', '=', avatar.id)
    .where('scopeId', '=', chain.scopeId)
    .executeTakeFirstOrThrow();

  expect(updated).toStrictEqual({ verifiedChainIndex: 10, verifiedNextSeed: 'aa'.repeat(16) });
});

import { expect, test } from 'bun:test';
import { createTestDB } from '@vers/service-test-utils/bun';
import { createActivityRow } from './create-activity-row';
import { createChainRow } from './create-chain-row';
import { updateAvatarChainsReplayPending } from './update-avatar-chains-replay-pending';

test('it flags a chain inserted after its activity has appends past the verified cursor', async () => {
  await using ctx = await createTestDB();

  const activity = await createActivityRow(ctx.db, { appendedHead: 3, scopeId: '0_0' });

  await ctx.db
    .insertInto('activityChains')
    .values({
      appendedNextSeed: activity.seed,
      avatarId: activity.avatarId,
      genesisSeed: activity.seed,
      scopeId: '0_0',
      scopeType: activity.scopeType,
      verifiedNextSeed: activity.seed,
    })
    .execute();

  await updateAvatarChainsReplayPending(ctx.db, activity.avatarId);

  const chain = await ctx.db
    .selectFrom('activityChains')
    .select('replayPending')
    .where('avatarId', '=', activity.avatarId)
    .executeTakeFirstOrThrow();

  expect(chain.replayPending).toBe(true);
});

test('it clears the flag on a chain whose activities have all verified', async () => {
  await using ctx = await createTestDB();

  const chain = await createChainRow(ctx.db);

  await createActivityRow(ctx.db, {
    appendedHead: 3,
    avatarId: chain.avatarId,
    scopeId: chain.scopeId,
    verifiedHead: 3,
  });

  await ctx.db
    .updateTable('activityChains')
    .set({ replayPending: true })
    .where('avatarId', '=', chain.avatarId)
    .execute();

  await updateAvatarChainsReplayPending(ctx.db, chain.avatarId);

  const stored = await ctx.db
    .selectFrom('activityChains')
    .select('replayPending')
    .where('avatarId', '=', chain.avatarId)
    .executeTakeFirstOrThrow();

  expect(stored.replayPending).toBe(false);
});

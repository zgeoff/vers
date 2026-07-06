import { expect, test } from 'bun:test';
import { createTestUser } from '@vers/service-test-utils/bun';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { setupTest } from '../test-utils/setup-test';

test('it deletes an owned avatar and reports the deleted id', async () => {
  await using ctx = await setupTest();
  const client = await ctx.client();
  const created = await client.createAvatar({ class: 'brute', name: 'Removable' });

  const result = await client.deleteAvatar({ id: created.id });

  expect(result).toStrictEqual({ deletedID: created.id });

  const row = await ctx.db
    .selectFrom('avatars')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it returns NOT_FOUND deleting an avatar the caller does not own', async () => {
  await using ctx = await setupTest();
  const other = await createTestUser(ctx.db);
  const foreign = await createAvatarRow(ctx.db, { name: 'Unremovable', userId: other.user.id });

  const client = await ctx.client();

  expect(client.deleteAvatar({ id: foreign.id })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const anonymousClient = await ctx.client(null);

  expect(anonymousClient.deleteAvatar({ id: 'x' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

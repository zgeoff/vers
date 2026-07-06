import { expect, test } from 'bun:test';
import { createTestUser } from '@vers/service-test-utils/bun';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { setupTest } from '../test-utils/setup-test';

test('it returns an owned avatar by id', async () => {
  await using ctx = await setupTest();
  const client = await ctx.client();
  const created = await client.createAvatar({ class: 'brute', name: 'Findable' });

  const found = await client.getAvatar({ id: created.id });

  expect(found).toStrictEqual(created);
});

test('it returns null for an avatar owned by another user', async () => {
  await using ctx = await setupTest();
  const other = await createTestUser(ctx.db);
  const foreign = await createAvatarRow(ctx.db, { name: 'Foreign', userId: other.user.id });

  const client = await ctx.client();
  const found = await client.getAvatar({ id: foreign.id });

  expect(found).toBeNull();
});

test('it returns null for an id that does not exist', async () => {
  await using ctx = await setupTest();
  const client = await ctx.client();

  const found = await client.getAvatar({ id: 'does-not-exist' });

  expect(found).toBeNull();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const anonymousClient = await ctx.client(null);

  expect(anonymousClient.getAvatar({ id: 'x' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

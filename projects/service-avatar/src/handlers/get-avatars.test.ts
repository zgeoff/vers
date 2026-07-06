import { expect, test } from 'bun:test';
import { createTestUser } from '@vers/service-test-utils/bun';
import { createAvatarRow } from '../test-utils/create-avatar-row';
import { setupTest } from '../test-utils/setup-test';

test('it lists only the acting user avatars', async () => {
  await using ctx = await setupTest();
  const client = await ctx.client();

  await client.createAvatar({ class: 'brute', name: 'OwnerAvatarOne' });
  await client.createAvatar({ class: 'scholar', name: 'OwnerAvatarTwo' });

  const avatars = await client.getAvatars({});

  expect(avatars.map((avatar) => avatar.name)).toIncludeSameMembers([
    'OwnerAvatarOne',
    'OwnerAvatarTwo',
  ]);
});

test('it excludes avatars owned by another user', async () => {
  await using ctx = await setupTest();
  const other = await createTestUser(ctx.db);

  await createAvatarRow(ctx.db, { name: 'NotYours', userId: other.user.id });

  const client = await ctx.client();
  const avatars = await client.getAvatars({});

  expect(avatars).toBeEmpty();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const anonymousClient = await ctx.client(null);

  expect(anonymousClient.getAvatars({})).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

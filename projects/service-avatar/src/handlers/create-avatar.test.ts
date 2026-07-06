import { expect, test } from 'bun:test';
import { setupTest } from '../test-utils/setup-test';

test('it creates an avatar owned by the acting user', async () => {
  await using ctx = await setupTest();
  const client = await ctx.client();

  const avatar = await client.createAvatar({ class: 'brute', name: 'Brutus' });

  expect(avatar).toStrictEqual({
    class: 'brute',
    createdAt: expect.toBeValidDate(),
    id: expect.toBeString(),
    level: 1,
    name: 'Brutus',
    updatedAt: expect.toBeValidDate(),
    userID: ctx.user.id,
    xp: 0,
  });
});

test('it rejects a second avatar with a duplicate name with CONFLICT', async () => {
  await using ctx = await setupTest();
  const client = await ctx.client();

  await client.createAvatar({ class: 'brute', name: 'Duplicatus' });

  expect(client.createAvatar({ class: 'scholar', name: 'Duplicatus' })).rejects.toMatchObject({
    code: 'CONFLICT',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const anonymousClient = await ctx.client(null);

  expect(anonymousClient.createAvatar({ class: 'brute', name: 'Anonymous' })).rejects.toMatchObject(
    { code: 'UNAUTHORIZED', data: { reason: 'missing-session' } },
  );
});

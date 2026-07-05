import { drop } from '@mswjs/data';
import { createTestJWT } from '@vers/service-test-utils';
import { afterEach, expect, test } from 'vitest';
import { env } from '~/env';
import { db } from '~/mocks/db';
import { server } from '~/mocks/node';
import { createMockGQLContext } from '~/test-utils/create-mock-gql-context';
import { resolve } from './get-avatars';

afterEach(() => {
  drop(db);
  server.resetHandlers();
});

test('it returns all avatars for the authenticated user', async () => {
  const user = db.user.create({});
  const otherUser = db.user.create({});

  const avatar = db.avatar.create({
    userID: user.id,
  });

  const avatar2 = db.avatar.create({
    userID: user.id,
  });

  // Create an avatar for another user - should not be returned
  db.avatar.create({
    userID: otherUser.id,
  });

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, user });
  const args = { input: {} };

  const result = await resolve({}, args, ctx);

  expect(result).toBeArray();
  expect(result).toHaveLength(2);

  expect(result).toIncludeAllPartialMembers([
    {
      createdAt: expect.any(Date),
      id: avatar.id,
      level: avatar.level,
      name: avatar.name,
      updatedAt: expect.any(Date),
      userID: user.id,
      xp: avatar.xp,
    },
    {
      createdAt: expect.any(Date),
      id: avatar2.id,
      level: avatar2.level,
      name: avatar2.name,
      updatedAt: expect.any(Date),
      userID: user.id,
      xp: avatar2.xp,
    },
  ]);
});

test('it returns an empty array when user has no avatar', async () => {
  const user = db.user.create({});

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, user });
  const args = { input: {} };

  const result = await resolve({}, args, ctx);

  expect(result).toBeArray();
  expect(result).toHaveLength(0);
});

test('it returns an unauthorized error when the user is not authenticated', async () => {
  const ctx = createMockGQLContext({});
  const args = { input: {} };

  await expect(() => resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});

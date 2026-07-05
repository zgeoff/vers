import { drop } from '@mswjs/data';
import { Class } from '@vers/data';
import { createTestJWT } from '@vers/service-test-utils';
import { afterEach, expect, test } from 'vitest';
import { env } from '../../env';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { resolve } from './get-avatar';

afterEach(() => {
  drop(db);
  server.resetHandlers();
});

test('it returns an avatar when found', async () => {
  const user = db.user.create({});

  const avatar = db.avatar.create({
    class: Class.Brute,
    level: 1,
    name: 'Test Avatar',
    userID: user.id,
    xp: 0,
  });

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, user });
  const args = { input: { id: avatar.id } };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    class: Class.Brute,
    createdAt: expect.any(Date),
    id: avatar.id,
    level: 1,
    name: 'Test Avatar',
    updatedAt: expect.any(Date),
    userID: user.id,
    xp: 0,
  });
});

test('it returns null when avatar is not found', async () => {
  const user = db.user.create({});

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, user });
  const args = { input: { id: 'non_existent_id' } };

  const result = await resolve({}, args, ctx);

  expect(result).toBeNull();
});

test('it returns an unauthorized error when the user is not authenticated', async () => {
  const ctx = createMockGQLContext({});
  const args = { input: { id: 'test_id' } };

  await expect(() => resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});

import { drop } from '@mswjs/data';
import { Class } from '@vers/data';
import { createTestJWT } from '@vers/service-test-utils';
import { afterEach, expect, test } from 'vitest';
import { env } from '../../env';
import { db } from '../../mocks/db';
import { server } from '../../mocks/node';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { resolve } from './create-avatar';

afterEach(() => {
  drop(db);
  server.resetHandlers();
});

test('it creates an avatar when the user has none', async () => {
  const user = db.user.create({});

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, user });

  const args = {
    input: {
      class: Class.Brute,
      name: 'Test Avatar',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    class: Class.Brute,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    createdAt: expect.any(Date),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    id: expect.any(String),
    level: 1,
    name: 'Test Avatar',
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    updatedAt: expect.any(Date),
    userID: user.id,
    xp: 0,
  });

  const avatar = db.avatar.findFirst({
    where: {
      userID: { equals: user.id },
    },
  });

  expect(avatar).toMatchObject({
    class: Class.Brute,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    createdAt: expect.any(Date),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    id: expect.any(String),
    level: 1,
    name: 'Test Avatar',
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    updatedAt: expect.any(Date),
    userID: user.id,
    xp: 0,
  });
});

test('it returns an error when the user has reached their avatar limit', async () => {
  const user = db.user.create({});

  db.avatar.create({ name: 'Avatar #1', userID: user.id });
  db.avatar.create({ name: 'Avatar #2', userID: user.id });

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, user });

  const args = {
    input: {
      class: Class.Brute,
      name: 'Avatar #3',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'Please delete one of your Avatars and try again.',
      title: 'Avatar limit reached',
    },
  });
});

test('it returns an error when the avatar name is already taken', async () => {
  const user = db.user.create({});

  db.avatar.create({
    name: 'Existing Avatar',
    userID: 'any_other_user_id',
  });

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, user });

  const args = {
    input: {
      class: Class.Brute,
      name: 'Existing Avatar',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'An Avatar with this name already exists.',
      title: 'Avatar name taken',
    },
  });
});

test('it returns an unauthorized error when the user is not authenticated', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      class: Class.Brute,
      name: 'Test Avatar',
    },
  };

  await expect(() => resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});

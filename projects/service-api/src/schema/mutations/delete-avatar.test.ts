import { drop } from '@mswjs/data';
import { createTestJWT } from '@vers/service-test-utils';
import { afterEach, expect, test } from 'vitest';
import { env } from '~/env';
import { db } from '~/mocks/db';
import { server } from '~/mocks/node';
import { createMockGQLContext } from '~/test-utils/create-mock-gql-context';
import { resolve } from './delete-avatar';

afterEach(() => {
  drop(db);
  server.resetHandlers();
});

test('it deletes an avatar when found', async () => {
  const user = db.user.create({});
  const avatar = db.avatar.create({
    userID: user.id,
  });

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, user });
  const args = {
    input: {
      id: avatar.id,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    success: true,
  });

  const deletedAvatar = db.avatar.findFirst({
    where: {
      id: { equals: avatar.id },
    },
  });

  expect(deletedAvatar).toBeNull();
});

test('it returns an unauthorized error when the user is not authenticated', async () => {
  const ctx = createMockGQLContext({});
  const args = {
    input: {
      id: 'test_id',
    },
  };

  await expect(() => resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});

import { drop } from '@mswjs/data';
import invariant from 'tiny-invariant';
import { expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { resolve } from './refresh-access-token';

test('it refreshes access token with valid refresh token', async () => {
  const user = db.user.create({});

  const session = db.session.create({
    refreshToken: 'valid_refresh_token',
    userID: user.id,
  });

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  invariant(session.refreshToken);

  const ctx = createMockGQLContext({ user });

  const args = {
    input: {
      refreshToken: session.refreshToken,
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    accessToken: expect.any(String),
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    refreshToken: expect.any(String),
  });

  // verify old refresh token is no longer valid
  const oldSession = db.session.findFirst({
    where: { refreshToken: { equals: session.refreshToken } },
  });

  expect(oldSession).toBeNull();

  drop(db);
});

test('it fails to refresh with invalid refresh token', async () => {
  const ctx = createMockGQLContext({});

  const args = {
    input: {
      refreshToken: 'invalid_refresh_token',
    },
  };

  const result = await resolve({}, args, ctx);

  expect(result).toStrictEqual({
    error: {
      message: 'An unknown error occurred',
      title: 'Unknown error occurred',
    },
  });
});

import { drop } from '@mswjs/data';
import { createTestJWT } from '@vers/service-test-utils';
import { expect, test } from 'vitest';
import { env } from '../../env';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { resolve } from './get-sessions';

test('it returns all sessions for the authenticated user', async () => {
  const user = db.user.create({});

  const session1 = db.session.create({
    userID: user.id,
  });

  const session2 = db.session.create({
    userID: user.id,
  });

  const accessToken = await createTestJWT({
    audience: env.API_IDENTIFIER,
    issuer: `https://${env.API_IDENTIFIER}/`,
    sub: user.id,
  });

  const ctx = createMockGQLContext({ accessToken, session: session1, user });

  const args = { input: {} };

  const result = await resolve({}, args, ctx);

  expect(result).toBeArray();
  expect(result).toHaveLength(2);

  expect(result).toIncludeAllPartialMembers([
    {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      expiresAt: expect.any(Date),
      id: session1.id,
      ipAddress: session1.ipAddress,
      userID: user.id,
    },
    {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
      expiresAt: expect.any(Date),
      id: session2.id,
      ipAddress: session2.ipAddress,
      userID: user.id,
    },
  ]);

  drop(db);
});

test('it returns an error if the user isnt authenticated', async () => {
  const ctx = createMockGQLContext({});
  const args = { input: {} };

  await expect(() => resolve({}, args, ctx)).rejects.toThrow('Unauthorized');
});

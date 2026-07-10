import { expect, test } from 'bun:test';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createUserService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns the acting user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  const result = await client.getCurrentUser({});

  expect(result).toStrictEqual({
    createdAt: viewer.user.createdAt,
    email: viewer.user.email,
    id: viewer.user.id,
    name: viewer.user.name,
    seed: viewer.user.seed,
    updatedAt: viewer.user.updatedAt,
    username: viewer.user.username,
  });
});

test('it throws UNAUTHORIZED when the acting user no longer exists', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });

  await ctx.db.deleteFrom('users').where('id', '=', viewer.user.id).execute();

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  expect(client.getCurrentUser({})).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  expect(client.getCurrentUser({})).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createUserService } from '../create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createUserService({ db: db.db });
  const app = service.app;

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it changes the acting user password', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  const result = await client.changePassword({ password: 'newpassword123' });

  expect(result).toStrictEqual({ updatedID: user.id });

  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();

  expect(row.passwordHash).not.toBe(user.passwordHash);
  expect(row.passwordHash).toStartWith('$argon2id$');
});

test('it throws NOT_FOUND when the acting user no longer exists', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-user', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;

  await ctx.db.deleteFrom('users').where('id', '=', user.id).execute();

  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.changePassword({ password: 'newpassword123' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-user' });
  const token = viewer.token;
  const client = buildRPCTestClient<UserContract>(ctx.app, { token });

  expect(client.changePassword({ password: 'newpassword123' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

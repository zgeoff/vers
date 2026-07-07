import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createSessionService } from '../create-session-service';
import { createSessionRow } from '../test-utils/create-session-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });
  const app = service.app;

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it deletes an owned session', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-session', db: ctx.db });
  const token = viewer.token;
  const user = viewer.user;
  const session = await createSessionRow(ctx.db, { userId: user.id });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const result = await client.deleteSession({ id: session.id });

  expect(result).toStrictEqual({});

  const row = await ctx.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', session.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it does not delete a session owned by a different user', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-session', db: ctx.db });
  const token = viewer.token;
  const other = await createViewer({ audience: 'service-session', db: ctx.db });
  const foreign = await createSessionRow(ctx.db, { userId: other.user.id });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const result = await client.deleteSession({ id: foreign.id });

  expect(result).toStrictEqual({});

  const row = await ctx.db
    .selectFrom('sessions')
    .selectAll()
    .where('id', '=', foreign.id)
    .executeTakeFirst();

  expect(row).not.toBeUndefined();
});

test('it silently no-ops for a session that does not exist', async () => {
  await using ctx = await setupTest();
  const viewer = await createViewer({ audience: 'service-session', db: ctx.db });
  const token = viewer.token;
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const result = await client.deleteSession({ id: 'does-not-exist' });

  expect(result).toStrictEqual({});
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const token = viewer.token;
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  expect(client.deleteSession({ id: 'x' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

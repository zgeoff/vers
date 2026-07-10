import { expect, test } from 'bun:test';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createSessionService } from '../create-session-service';
import { createSessionRow } from '../test-utils/create-session-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns an owned session by id', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-session', db: ctx.db });
  const session = await createSessionRow(ctx.db, { userId: viewer.user.id });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const found = await client.getSession({ id: session.id });

  expect(found).toStrictEqual({
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    id: session.id,
    ipAddress: session.ipAddress,
    updatedAt: session.updatedAt,
    userID: viewer.user.id,
    verified: session.verified,
  });
});

test('it returns null when the session belongs to a different user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-session', db: ctx.db });
  const other = await createViewer({ audience: 'service-session', db: ctx.db });
  const foreign = await createSessionRow(ctx.db, { userId: other.user.id });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const found = await client.getSession({ id: foreign.id });

  expect(found).toBeNull();
});

test('it returns null for an id that does not exist', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-session', db: ctx.db });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const found = await client.getSession({ id: 'does-not-exist' });

  expect(found).toBeNull();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(client.getSession({ id: 'x' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

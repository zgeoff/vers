import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createSessionService } from '../create-session-service';
import { createSessionRow } from '../test-utils/create-session-row';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createSessionService({ db: db.db });

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns an owned session by id', async () => {
  await using ctx = await setupTest();
  const { token, user } = await createViewer({ audience: 'service-session', db: ctx.db });
  const session = await createSessionRow(ctx.db, { userId: user.id });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const found = await client.getSession({ id: session.id });

  expect(found).toStrictEqual({
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    id: session.id,
    ipAddress: session.ipAddress,
    updatedAt: session.updatedAt,
    userID: user.id,
    verified: session.verified,
  });
});

test('it returns null when the session belongs to a different user', async () => {
  await using ctx = await setupTest();
  const { token } = await createViewer({ audience: 'service-session', db: ctx.db });
  const other = await createViewer({ audience: 'service-session', db: ctx.db });
  const foreign = await createSessionRow(ctx.db, { userId: other.user.id });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const found = await client.getSession({ id: foreign.id });

  expect(found).toBeNull();
});

test('it returns null for an id that does not exist', async () => {
  await using ctx = await setupTest();
  const { token } = await createViewer({ audience: 'service-session', db: ctx.db });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const found = await client.getSession({ id: 'does-not-exist' });

  expect(found).toBeNull();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  expect(client.getSession({ id: 'x' })).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

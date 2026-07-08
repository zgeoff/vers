import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createViewer } from '@vers/service-test-utils/bun';
import { createSessionService } from '../create-session-service';
import { createSessionRow } from '../test-utils/create-session-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it only returns sessions belonging to the acting user', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-session', db: ctx.db });
  const other = await createViewer({ audience: 'service-session', db: ctx.db });
  const owned = await createSessionRow(ctx.db, { userId: viewer.user.id });

  await createSessionRow(ctx.db, { userId: other.user.id });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const found = await client.getSessions({});

  expect(found).toStrictEqual([
    {
      createdAt: owned.createdAt,
      expiresAt: owned.expiresAt,
      id: owned.id,
      ipAddress: owned.ipAddress,
      updatedAt: owned.updatedAt,
      userID: viewer.user.id,
      verified: owned.verified,
    },
  ]);
});

test('it returns an empty array when the acting user has no sessions', async () => {
  await using ctx = await setupTest();

  const viewer = await createViewer({ audience: 'service-session', db: ctx.db });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  const found = await client.getSessions({});

  expect(found).toBeEmpty();
});

test('it rejects an anonymous acting user with UNAUTHORIZED', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  expect(client.getSessions({})).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
    data: { reason: 'missing-session' },
  });
});

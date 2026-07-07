import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createSessionService } from '../create-session-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });
  const app = service.app;

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates an unverified session with the short duration by default', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const user = created.user;
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const token = viewer.token;
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const before = Date.now();
  const session = await client.createSession({ ipAddress: '127.0.0.1', userID: user.id });

  expect(session).toStrictEqual({
    createdAt: expect.toBeDate(),
    expiresAt: expect.toBeDate(),
    id: expect.toBeString(),
    ipAddress: '127.0.0.1',
    updatedAt: expect.toBeDate(),
    userID: user.id,
    verified: false,
  });

  expect(session.expiresAt.getTime() - before).toBeWithin(
    24 * 60 * 60 * 1000 - 5000,
    24 * 60 * 60 * 1000 + 5000,
  );
});

test('it creates a session with the long duration when rememberMe is set', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const user = created.user;
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const token = viewer.token;
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const before = Date.now();

  const session = await client.createSession({
    ipAddress: '127.0.0.1',
    rememberMe: true,
    userID: user.id,
  });

  expect(session.expiresAt.getTime() - before).toBeWithin(
    7 * 24 * 60 * 60 * 1000 - 5000,
    7 * 24 * 60 * 60 * 1000 + 5000,
  );
});

test('it honors an explicit expiresAt over the default duration', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const user = created.user;
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const token = viewer.token;
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token });

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const session = await client.createSession({
    expiresAt,
    ipAddress: '127.0.0.1',
    userID: user.id,
  });

  expect(session.expiresAt).toStrictEqual(expiresAt);
});

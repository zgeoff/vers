import { expect, test } from 'bun:test';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createSessionService } from './create-session-service';

test('it wires an injected db into the router instead of building one from env', async () => {
  await using db = await createTestDB();

  const service = await createSessionService({ db: db.db });
  const created = await createTestUser(db.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session' });

  const client = buildRPCTestClient<SessionContract>(service.app, { token: viewer.token });

  await client.createSession({ ipAddress: '127.0.0.1', userID: created.user.id });

  const rows = await db.db.selectFrom('sessions').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it boots from env.DATABASE_URL when no db is injected', async () => {
  const service = await createSessionService();

  expect(service.env.DATABASE_URL).toStartWith('postgres://');
});

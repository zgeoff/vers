import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { SessionContract } from '@vers/contract-session';
import { createAnonymousViewer, createTestDB, createTestUser } from '@vers/service-test-utils/bun';
import { createSessionService } from './create-session-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createSessionService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

// Each call acquires its own transaction-isolated handle from the same shared worker database
// (`@vers/service-test-utils/bun`'s default isolation). These two tests prove the rollback
// actually holds across test boundaries — order-dependent by design.

test('it creates a session visible within this test', async () => {
  await using ctx = await setupTest();
  const created = await createTestUser(ctx.db);
  const viewer = await createAnonymousViewer({ audience: 'service-session' });
  const client = buildRPCTestClient<SessionContract>(ctx.app, { token: viewer.token });

  await client.createSession({ ipAddress: '127.0.0.1', userID: created.user.id });

  const rows = await ctx.db.selectFrom('sessions').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it starts with no sessions left over from the previous test', async () => {
  await using ctx = await setupTest();

  const rows = await ctx.db.selectFrom('sessions').selectAll().execute();

  expect(rows).toBeEmpty();
});

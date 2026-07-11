import { expect, test } from 'bun:test';
import type { UserContract } from '@vers/contract-user';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createUserService } from './create-user-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createUserService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

// Each call acquires its own transaction-isolated handle from the same shared worker database
// (`@vers/service-test-utils/bun`'s default isolation). These two tests prove the rollback
// actually holds across test boundaries — order-dependent by design.

test('it creates a user visible within this test', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-user' });

  const client = buildRPCTestClient<UserContract>(ctx.app, { token: viewer.token });

  await client.createUser({
    email: 'isolation-proof@example.com',
    name: 'Isolation Proof',
    password: 'password123',
    username: 'isolation_proof',
  });

  const rows = await ctx.db.selectFrom('users').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it starts with no users left over from the previous test', async () => {
  await using ctx = await setupTest();

  const rows = await ctx.db.selectFrom('users').selectAll().execute();

  expect(rows).toBeEmpty();
});

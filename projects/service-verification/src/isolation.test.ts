import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { VerificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createVerificationService } from './create-verification-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createVerificationService({ db: db.db });
  const app = service.app;

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

// Each call acquires its own transaction-isolated handle from the same shared worker database
// (`@vers/service-test-utils/bun`'s default isolation). These two tests prove the rollback
// actually holds across test boundaries — order-dependent by design.

test('it creates a verification visible within this test', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });
  const token = viewer.token;
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  await client.createVerification({ target: 'isolation-proof@example.com', type: 'onboarding' });

  const rows = await ctx.db.selectFrom('verifications').selectAll().execute();

  expect(rows).toHaveLength(1);
});

test('it starts with no verifications left over from the previous test', async () => {
  await using ctx = await setupTest();

  const rows = await ctx.db.selectFrom('verifications').selectAll().execute();

  expect(rows).toBeEmpty();
});

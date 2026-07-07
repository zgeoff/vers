import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { VerificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createVerificationService } from '../create-verification-service';
import { createVerificationRow } from '../test-utils/create-verification-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createVerificationService({ db: db.db });
  const app = service.app;

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it returns an existing verification', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });
  const token = viewer.token;
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const verification = await createVerificationRow(ctx.db, {
    target: 'existing@example.com',
    type: 'onboarding',
  });

  const found = await client.getVerification({
    target: 'existing@example.com',
    type: 'onboarding',
  });

  expect(found).toStrictEqual({
    id: verification.id,
    target: 'existing@example.com',
    type: 'onboarding',
  });
});

test('it returns null for a non-existent verification', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });
  const token = viewer.token;
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const found = await client.getVerification({ target: 'missing@example.com', type: 'onboarding' });

  expect(found).toBeNull();
});

test('it deletes an expired verification and returns null', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });
  const token = viewer.token;
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const verification = await createVerificationRow(ctx.db, {
    expiresAt: new Date(Date.now() - 60_000),
    target: 'expired@example.com',
    type: 'onboarding',
  });

  const found = await client.getVerification({ target: 'expired@example.com', type: 'onboarding' });

  expect(found).toBeNull();

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', verification.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

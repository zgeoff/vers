import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { VerificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createVerificationService } from '../create-verification-service';
import { createVerificationRow } from '../test-utils/create-verification-row';

async function setupTest() {
  const db = await createTestDB();
  const service = await createVerificationService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it updates a verification record', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });
  const verification = await createVerificationRow(ctx.db, { type: 'onboarding' });

  const result = await client.updateVerification({ id: verification.id, type: '2fa' });

  expect(result).toStrictEqual({ updatedID: verification.id });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', verification.id)
    .executeTakeFirstOrThrow();

  expect(row.type).toBe('2fa');
});

test('it leaves the record unchanged when no fields are provided', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });
  const verification = await createVerificationRow(ctx.db, { type: 'onboarding' });

  const result = await client.updateVerification({ id: verification.id });

  expect(result).toStrictEqual({ updatedID: verification.id });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', verification.id)
    .executeTakeFirstOrThrow();

  expect(row.type).toBe('onboarding');
});

test('it throws NOT_FOUND when no fields are provided and the verification does not exist', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

  expect(client.updateVerification({ id: 'does-not-exist' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('it throws NOT_FOUND when the verification does not exist', async () => {
  await using ctx = await setupTest();
  const viewer = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

  expect(client.updateVerification({ id: 'does-not-exist', type: '2fa' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

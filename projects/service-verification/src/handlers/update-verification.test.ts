import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { VerificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createVerificationService } from '../create-verification-service';
import { createVerificationRow } from '../test-utils/create-verification-row';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createVerificationService({ db: db.db });

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it updates a verification record', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });
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

test('it throws NOT_FOUND when the verification does not exist', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  expect(client.updateVerification({ id: 'does-not-exist', type: '2fa' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

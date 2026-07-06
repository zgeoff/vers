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

test('it deletes a verification record', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });
  const verification = await createVerificationRow(ctx.db);

  const result = await client.deleteVerification({ id: verification.id });

  expect(result).toStrictEqual({ deletedID: verification.id });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', verification.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it throws NOT_FOUND when the verification does not exist', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  expect(client.deleteVerification({ id: 'does-not-exist' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

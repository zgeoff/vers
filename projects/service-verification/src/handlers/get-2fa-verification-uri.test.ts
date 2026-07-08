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

test('it returns a TOTP auth URI for a pending 2fa setup', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

  await createVerificationRow(ctx.db, { target: 'setup@example.com', type: '2fa-setup' });

  const result = await client.get2FAVerificationURI({ target: 'setup@example.com' });

  expect(result.otpURI).toStartWith('otpauth://totp/');
});

test('it throws NOT_FOUND when no 2fa setup verification exists for the target', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

  expect(client.get2FAVerificationURI({ target: 'missing@example.com' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

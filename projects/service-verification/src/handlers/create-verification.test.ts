import { expect, test } from 'bun:test';
import { buildRPCTestClient } from '@vers/contract-base/test-utils';
import type { VerificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { createVerificationService } from '../create-verification-service';

async function setupTest() {
  const db = await createTestDB();
  const { app } = await createVerificationService({ db: db.db });

  return { app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates a verification code and stores a record of it', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const created = await client.createVerification({
    target: 'onboard@example.com',
    type: 'onboarding',
  });

  expect(created).toStrictEqual({
    id: expect.toBeString(),
    otp: expect.toBeString(),
    target: 'onboard@example.com',
    type: 'onboarding',
  });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirstOrThrow();

  expect(row.target).toBe('onboard@example.com');
});

test('it uses a simple charset for 2fa verification codes', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const created = await client.createVerification({ target: '+15551234567', type: '2fa' });

  expect(created.otp).toMatch(/^[0-9]+$/);
});

test('it uses a simple charset for 2fa setup verification codes', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const created = await client.createVerification({ target: '+15551234567', type: '2fa-setup' });

  expect(created.otp).toMatch(/^[0-9]+$/);
});

test('it replaces an existing verification for the same target and type', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  await client.createVerification({ target: 'replace@example.com', type: 'onboarding' });

  const second = await client.createVerification({
    target: 'replace@example.com',
    type: 'onboarding',
  });

  const rows = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('target', '=', 'replace@example.com')
    .execute();

  expect(rows).toHaveLength(1);
  expect(rows[0]?.id).toBe(second.id);
});

test('it creates a verification with an explicit expiry time', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const expiresAt = new Date(Date.now() + 60_000);

  const created = await client.createVerification({
    expiresAt,
    target: 'expiring@example.com',
    type: 'onboarding',
  });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirstOrThrow();

  expect(row.expiresAt).toEqual(expiresAt);
});

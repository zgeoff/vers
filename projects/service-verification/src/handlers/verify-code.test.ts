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

test('it verifies a valid code', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const created = await client.createVerification({
    target: 'onboard@example.com',
    type: 'onboarding',
  });

  const result = await client.verifyCode({
    code: created.otp,
    target: 'onboard@example.com',
    type: 'onboarding',
  });

  expect(result).toStrictEqual({
    id: expect.toBeString(),
    target: 'onboard@example.com',
    type: 'onboarding',
  });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it rejects an invalid code with INVALID_CODE', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  await createVerificationRow(ctx.db, { target: 'invalid@example.com', type: 'onboarding' });

  expect(
    client.verifyCode({ code: 'wrong-code', target: 'invalid@example.com', type: 'onboarding' }),
  ).rejects.toMatchObject({ code: 'INVALID_CODE' });
});

test('it rejects an expired code with CODE_EXPIRED and deletes it', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const verification = await createVerificationRow(ctx.db, {
    expiresAt: new Date(Date.now() - 60_000),
    target: 'expired@example.com',
    type: 'onboarding',
  });

  expect(
    client.verifyCode({ code: 'wrong-code', target: 'expired@example.com', type: 'onboarding' }),
  ).rejects.toMatchObject({ code: 'CODE_EXPIRED' });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', verification.id)
    .executeTakeFirst();

  expect(row).toBeUndefined();
});

test('it does not delete a 2fa setup verification', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });
  const created = await client.createVerification({ target: '+15551234567', type: '2fa-setup' });

  await client.verifyCode({ code: created.otp, target: '+15551234567', type: '2fa-setup' });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirst();

  expect(row).not.toBeUndefined();
});

test('it does not delete a 2fa verification', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });
  const created = await client.createVerification({ target: '+15551234568', type: '2fa' });

  await client.verifyCode({ code: created.otp, target: '+15551234568', type: '2fa' });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirst();

  expect(row).not.toBeUndefined();
});

test('it rejects an immediately replayed 2fa code with CODE_ALREADY_USED', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });
  const created = await client.createVerification({ target: '+15551234569', type: '2fa' });

  await client.verifyCode({ code: created.otp, target: '+15551234569', type: '2fa' });

  expect(
    client.verifyCode({ code: created.otp, target: '+15551234569', type: '2fa' }),
  ).rejects.toMatchObject({ code: 'CODE_ALREADY_USED' });
});

test('it records the verified code and timestamp on a successful 2fa verification', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });
  const created = await client.createVerification({ target: '+15551234570', type: '2fa' });

  await client.verifyCode({ code: created.otp, target: '+15551234570', type: '2fa' });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirstOrThrow();

  expect(row.lastVerifiedCode).toBe(created.otp);
  expect(row.lastVerifiedAt).toBeValidDate();
});

test('it accepts the same 2fa code again once the replay window has passed', async () => {
  await using ctx = await setupTest();
  const { token } = await createAnonymousViewer({ audience: 'service-verification' });
  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token });

  const created = await client.createVerification({
    period: 300,
    target: '+15551234571',
    type: '2fa',
  });

  await client.verifyCode({ code: created.otp, target: '+15551234571', type: '2fa' });

  await ctx.db
    .updateTable('verifications')
    .set({ lastVerifiedAt: new Date(Date.now() - 300 * 2 * 1000 - 1000) })
    .where('id', '=', created.id)
    .execute();

  await expect(
    client.verifyCode({ code: created.otp, target: '+15551234571', type: '2fa' }),
  ).toResolve();
});

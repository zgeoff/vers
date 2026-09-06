import { expect, test } from 'bun:test';
import type { VerificationContract } from '@vers/contract-verification';
import { createAnonymousViewer, createTestDB } from '@vers/service-test-utils/bun';
import { buildRPCTestClient } from '@vers/test-utils';
import { createVerificationService } from '../create-verification-service';

async function setupTest() {
  const db = await createTestDB();
  const service = await createVerificationService({ db: db.db });

  return { app: service.app, db: db.db, [Symbol.asyncDispose]: db[Symbol.asyncDispose] };
}

test('it creates a verification code and stores a record of it', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

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

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

  const created = await client.createVerification({ target: '+15551234567', type: '2fa' });

  expect(created.otp).toMatch(/^[0-9]+$/);
});

test('it uses a simple charset for 2fa setup verification codes', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

  const created = await client.createVerification({ target: '+15551234567', type: '2fa-setup' });

  expect(created.otp).toMatch(/^[0-9]+$/);
});

test('it replaces an existing verification for the same target and type', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

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

test('it clears the replay guard when a verification is recreated', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

  const created = await client.createVerification({ target: '+15551234599', type: '2fa' });

  await client.verifyCode({ code: created.otp, target: '+15551234599', type: '2fa' });

  const verified = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('target', '=', '+15551234599')
    .executeTakeFirstOrThrow();

  expect(verified.lastVerifiedCode).toBe(created.otp);
  expect(verified.lastVerifiedAt).toBeValidDate();

  await client.createVerification({ target: '+15551234599', type: '2fa' });

  const recreated = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('target', '=', '+15551234599')
    .executeTakeFirstOrThrow();

  expect(recreated.lastVerifiedCode).toBeNull();
  expect(recreated.lastVerifiedAt).toBeNull();
});

test('it creates a verification with an explicit expiry time', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

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

  expect(row.expiresAt).toStrictEqual(expiresAt);
});

test.each(['onboarding', 'change-email'] as const)(
  'it gives a %s code a ten-minute period and expiry',
  async (type) => {
    await using ctx = await setupTest();

    const viewer = await createAnonymousViewer({ audience: 'service-verification' });

    const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });
    const before = Date.now();

    const created = await client.createVerification({ target: 'emailed@example.com', type });

    const row = await ctx.db
      .selectFrom('verifications')
      .selectAll()
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();

    expect(row.period).toBe(600);
    expect(row.expiresAt).toBeBetween(new Date(before + 600_000), new Date(Date.now() + 600_000));
  },
);

test.each(['2fa', '2fa-setup'] as const)(
  'it keeps a %s code on a 30-second period with no expiry',
  async (type) => {
    await using ctx = await setupTest();

    const viewer = await createAnonymousViewer({ audience: 'service-verification' });

    const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

    const created = await client.createVerification({ target: '+15551234567', type });

    const row = await ctx.db
      .selectFrom('verifications')
      .selectAll()
      .where('id', '=', created.id)
      .executeTakeFirstOrThrow();

    expect(row.period).toBe(30);
    expect(row.expiresAt).toBeNull();
  },
);

test('it keeps an explicit null expiry on an emailed code', async () => {
  await using ctx = await setupTest();

  const viewer = await createAnonymousViewer({ audience: 'service-verification' });

  const client = buildRPCTestClient<VerificationContract>(ctx.app, { token: viewer.token });

  const created = await client.createVerification({
    expiresAt: null,
    target: 'no-expiry@example.com',
    type: 'onboarding',
  });

  const row = await ctx.db
    .selectFrom('verifications')
    .selectAll()
    .where('id', '=', created.id)
    .executeTakeFirstOrThrow();

  expect(row.expiresAt).toBeNull();
});

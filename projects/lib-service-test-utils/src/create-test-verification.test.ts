import { expect, test } from 'vitest';
import { createTestDB } from './create-test-db';
import { createTestVerification } from './create-test-verification';

test('it creates a test verification with the expected data', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const verification = await createTestVerification(db);

  expect(verification).toStrictEqual({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    createdAt: expect.any(Date),
    digits: 6,
    expiresAt: null,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    id: expect.any(String),
    period: 30,
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    secret: expect.any(String),
    target: 'test@example.com',
    type: '2fa',
  });
});

test('it allows overriding the default verification data', async () => {
  await using handle = await createTestDB();

  const { db } = handle;

  const verification = await createTestVerification(db, {
    target: 'test@test.com',
    type: '2fa',
  });

  expect(verification.target).toBe('test@test.com');
  expect(verification.type).toBe('2fa');
});

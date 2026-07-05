import { drop } from '@mswjs/data';
import { afterEach, expect, test } from 'vitest';
import { db } from '../../mocks/db';
import { createMockGQLContext } from '../../test-utils/create-mock-gql-context';
import { resolve } from './get-enable-2fa-verification';

afterEach(() => {
  drop(db);
});

test('it retrieves the 2FA verification URI', async () => {
  const user = db.user.create({
    email: 'test@example.com',
  });

  // Create a 2FA setup verification record
  db.verification.create({
    algorithm: 'SHA-1',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    digits: 6,
    period: 30,
    secret: 'ABCDEFGHIJKLMNOP',
    target: user.email,
    type: '2fa-setup',
  });

  const ctx = createMockGQLContext({ user });

  const result = await resolve({}, {}, ctx);

  expect(result).toStrictEqual({
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
    otpURI: expect.any(String),
  });

  expect(result.otpURI).toMatch('otpauth://totp/vers:test%40example.com');
});

test('it throws an error if unauthorized', async () => {
  const ctx = createMockGQLContext({});

  await expect(resolve({}, {}, ctx)).rejects.toThrow('Unauthorized');
});

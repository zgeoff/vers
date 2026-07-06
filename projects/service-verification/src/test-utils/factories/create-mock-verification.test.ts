import { expect, test } from 'bun:test';
import { createMockVerification } from './create-mock-verification';

test('it builds a default verification row', () => {
  const row = createMockVerification();

  expect(row).toStrictEqual({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    digits: 6,
    expiresAt: null,
    id: expect.toBeString(),
    period: 30,
    secret: expect.toBeString(),
    target: expect.toBeString(),
    type: 'onboarding',
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockVerification({ target: 'fixed@example.com', type: '2fa' });

  expect(row).toStrictEqual({
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    digits: 6,
    expiresAt: null,
    id: expect.toBeString(),
    period: 30,
    secret: expect.toBeString(),
    target: 'fixed@example.com',
    type: '2fa',
  });
});

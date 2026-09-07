import { expect, test } from 'bun:test';
import { buildPasswordFromBytes } from './build-password-from-bytes';

test('it encodes the bytes as base64url so every byte value maps evenly', () => {
  const password = buildPasswordFromBytes(new Uint8Array(21).map((_, index) => index * 12));

  expect(password).toHaveLength(28);
  expect(password).toMatch(/^[A-Za-z0-9_-]+$/);
});

test('it maps equal bytes to the same password', () => {
  const bytes = new Uint8Array(20).fill(200);

  expect(buildPasswordFromBytes(bytes)).toBe(buildPasswordFromBytes(bytes));
});

test('it refuses fewer than 16 bytes of entropy', () => {
  expect(() => buildPasswordFromBytes(new Uint8Array(8))).toThrowWithMessage(
    Error,
    /at least 16 bytes/,
  );
});

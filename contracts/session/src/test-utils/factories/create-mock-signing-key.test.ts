import { expect, test } from 'bun:test';
import { SigningKeySchema } from '../../signing-key-set-schema';
import { createMockSigningKey } from './create-mock-signing-key';

test('it builds a default signing key', () => {
  const key = createMockSigningKey();

  expect(key).toStrictEqual({
    alg: 'RS256',
    e: 'AQAB',
    kid: expect.toBeString(),
    kty: 'RSA',
    n: expect.toBeString(),
    use: 'sig',
  });

  expect(SigningKeySchema.parse(key)).toStrictEqual(key);
});

test('it applies overrides on top of the defaults', () => {
  const key = createMockSigningKey({ alg: 'ES256', kid: 'fixed', kty: 'EC' });

  expect(key.alg).toBe('ES256');
  expect(key.kid).toBe('fixed');
  expect(key.kty).toBe('EC');
  expect(key.use).toBe('sig');
});

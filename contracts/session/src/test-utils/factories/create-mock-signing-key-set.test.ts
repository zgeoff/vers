import { expect, test } from 'bun:test';
import { SigningKeySetSchema } from '../../signing-key-set-schema';
import { createMockSigningKey } from './create-mock-signing-key';
import { createMockSigningKeySet } from './create-mock-signing-key-set';

test('it builds a default signing key set', () => {
  const keySet = createMockSigningKeySet();

  expect(keySet).toStrictEqual({
    keys: [
      {
        alg: 'RS256',
        e: 'AQAB',
        kid: expect.toBeString(),
        kty: 'RSA',
        n: expect.toBeString(),
        use: 'sig',
      },
    ],
  });

  expect(SigningKeySetSchema.parse(keySet)).toStrictEqual(keySet);
});

test('it applies overrides on top of the defaults', () => {
  const keys = [createMockSigningKey({ kid: 'active' }), createMockSigningKey({ kid: 'retired' })];
  const keySet = createMockSigningKeySet({ keys });

  expect(keySet.keys).toBe(keys);
});

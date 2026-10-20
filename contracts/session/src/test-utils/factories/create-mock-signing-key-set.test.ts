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
        // oxlint-disable-next-line id-length -- RFC 7518 names the RSA key's exponent and modulus `e` and `n`
        e: 'AQAB',
        kid: expect.toBeString(),
        kty: 'RSA',
        // oxlint-disable-next-line id-length -- RFC 7518 names the RSA key's exponent and modulus `e` and `n`
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

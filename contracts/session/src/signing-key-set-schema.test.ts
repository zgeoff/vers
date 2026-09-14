import { expect, test } from 'bun:test';
import { SigningKeySetSchema } from './signing-key-set-schema';

test('it accepts a key set whose keys carry the four required members plus key-type members', () => {
  const payload = {
    keys: [{ alg: 'RS256', e: 'AQAB', kid: 'thumb', kty: 'RSA', n: 'abc', use: 'sig' as const }],
  };

  expect(SigningKeySetSchema.parse(payload)).toStrictEqual(payload);
});

test('it rejects a key that is not marked for signatures', () => {
  const result = SigningKeySetSchema.safeParse({
    keys: [{ alg: 'RS256', e: 'AQAB', kid: 'thumb', kty: 'RSA', n: 'abc', use: 'enc' }],
  });

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['keys', 0, 'use'] }),
  );
});

test('it rejects a key without a key id', () => {
  const result = SigningKeySetSchema.safeParse({
    keys: [{ alg: 'RS256', e: 'AQAB', kty: 'RSA', n: 'abc', use: 'sig' }],
  });

  expect(result.error?.issues).toPartiallyContain(
    expect.objectContaining({ path: ['keys', 0, 'kid'] }),
  );
});

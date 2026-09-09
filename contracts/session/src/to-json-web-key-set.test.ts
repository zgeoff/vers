import { expect, test } from 'bun:test';
import { toJSONWebKeySet } from './to-json-web-key-set';

test('it copies every published key into a mutable key set', () => {
  const published = {
    keys: [{ alg: 'RS256', e: 'AQAB', kid: 'thumb', kty: 'RSA', n: 'abc', use: 'sig' as const }],
  };

  const keySet = toJSONWebKeySet(published);

  expect(keySet).toStrictEqual(published);
  expect(keySet.keys[0]).not.toBe(published.keys[0]);
});

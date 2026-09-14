import { expect, test } from 'bun:test';
import { createMockSigningKeySet } from './test-utils/factories/create-mock-signing-key-set';
import { toJSONWebKeySet } from './to-json-web-key-set';

test('it copies every published key into a mutable key set', () => {
  const published = createMockSigningKeySet();
  const keySet = toJSONWebKeySet(published);

  expect(keySet).toStrictEqual({ keys: [...published.keys] });
  expect(keySet.keys[0]).not.toBe(published.keys[0]);
});

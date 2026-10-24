import { expect, test } from 'bun:test';
import { buildGrantTokenHash } from './build-grant-token-hash';

test('it hashes a grant token to its hex SHA-256 digest', () => {
  expect(buildGrantTokenHash('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

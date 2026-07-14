import { expect, test } from 'bun:test';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { buildRollDigest } from './build-roll-digest';

test('it matches the RFC 4231 HMAC-SHA256 test case 1 vector', () => {
  const avatarKey = new Uint8Array(20).fill(0x0b);

  const coordinateBytes = utf8ToBytes('Hi There');

  expect(buildRollDigest(avatarKey, coordinateBytes)).toBe(
    'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
  );
});

test('it matches the RFC 4231 HMAC-SHA256 test case 2 vector', () => {
  const avatarKey = utf8ToBytes('Jefe');
  const coordinateBytes = utf8ToBytes('what do ya want for nothing?');

  expect(buildRollDigest(avatarKey, coordinateBytes)).toBe(
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
  );
});

test('it builds bit-identical digests for identical input', () => {
  const avatarKey = utf8ToBytes('avatar-key');
  const coordinateBytes = utf8ToBytes('coordinate');

  expect(buildRollDigest(avatarKey, coordinateBytes)).toBe(
    buildRollDigest(avatarKey, coordinateBytes),
  );
});

test('it builds a different digest for a different avatar key', () => {
  const coordinateBytes = utf8ToBytes('coordinate');

  expect(buildRollDigest(utf8ToBytes('key-a'), coordinateBytes)).not.toBe(
    buildRollDigest(utf8ToBytes('key-b'), coordinateBytes),
  );
});

test('it builds a different digest for different coordinate bytes', () => {
  const avatarKey = utf8ToBytes('avatar-key');

  expect(buildRollDigest(avatarKey, utf8ToBytes('coordinate-a'))).not.toBe(
    buildRollDigest(avatarKey, utf8ToBytes('coordinate-b')),
  );
});

test('it formats the digest as lowercase hex', () => {
  const avatarKey = utf8ToBytes('avatar-key');
  const coordinateBytes = utf8ToBytes('coordinate');

  expect(buildRollDigest(avatarKey, coordinateBytes)).toMatch(/^[0-9a-f]{64}$/);
});

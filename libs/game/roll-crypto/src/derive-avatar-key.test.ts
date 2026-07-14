import { expect, test } from 'bun:test';
import { bytesToHex } from '@noble/hashes/utils.js';
import { deriveAvatarKey } from './derive-avatar-key';

const root = new Uint8Array(32).fill(0x0b);

test('it derives a frozen golden key from fixed inputs', () => {
  const key = deriveAvatarKey({ root, population: 'trade', avatarID: 'avatar_1', keyVersion: 1 });

  expect(bytesToHex(key)).toBe('a5e94c424e91834d096c382cb780ee2ae307920c0096766a3eee9ef1e2d33944');
});

test('it derives bit-identical keys for identical input', () => {
  const input = { root, population: 'trade', avatarID: 'avatar_1', keyVersion: 1 } as const;

  expect(deriveAvatarKey(input)).toStrictEqual(deriveAvatarKey(input));
});

test('it derives a different key for a different population', () => {
  const tradeKey = deriveAvatarKey({
    root,
    population: 'trade',
    avatarID: 'avatar_1',
    keyVersion: 1,
  });

  const selfFoundKey = deriveAvatarKey({
    root,
    population: 'self-found',
    avatarID: 'avatar_1',
    keyVersion: 1,
  });

  expect(tradeKey).not.toStrictEqual(selfFoundKey);
});

test('it derives a different key for a different avatar ID', () => {
  const key1 = deriveAvatarKey({ root, population: 'trade', avatarID: 'avatar_1', keyVersion: 1 });
  const key2 = deriveAvatarKey({ root, population: 'trade', avatarID: 'avatar_2', keyVersion: 1 });

  expect(key1).not.toStrictEqual(key2);
});

test('it derives a different key for a different key version', () => {
  const keyV1 = deriveAvatarKey({ root, population: 'trade', avatarID: 'avatar_1', keyVersion: 1 });
  const keyV2 = deriveAvatarKey({ root, population: 'trade', avatarID: 'avatar_1', keyVersion: 2 });

  expect(keyV1).not.toStrictEqual(keyV2);
});

test('it derives a 32-byte key', () => {
  const key = deriveAvatarKey({ root, population: 'trade', avatarID: 'avatar_1', keyVersion: 1 });

  expect(key).toHaveLength(32);
});

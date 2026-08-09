import { expect, test } from 'bun:test';
import { bytesToHex } from '@noble/hashes/utils.js';
import { deriveScopeSecret } from './derive-scope-secret';

const root = new Uint8Array(32).fill(0x0b);

test('it derives a frozen golden secret from fixed inputs', () => {
  const secret = deriveScopeSecret({
    root,
    secretRef: 'worldmap',
    avatarID: 'avatar_1',
    secretVersion: 1,
  });

  expect(bytesToHex(secret)).toMatchInlineSnapshot(
    `"c2804a5fc15ab9b3cbf1d75e38bb352b7327b8f74c82892bd6bd65641943bae2"`,
  );
});

test('it derives bit-identical secrets for identical input', () => {
  const input = {
    root,
    secretRef: 'worldmap',
    avatarID: 'avatar_1',
    secretVersion: 1,
  } as const;

  expect(deriveScopeSecret(input)).toStrictEqual(deriveScopeSecret(input));
});

test('it derives a different secret for a different secret ref', () => {
  const worldmapSecret = deriveScopeSecret({
    root,
    secretRef: 'worldmap',
    avatarID: 'avatar_1',
    secretVersion: 1,
  });

  const otherSecret = deriveScopeSecret({
    root,
    secretRef: 'other-scope',
    avatarID: 'avatar_1',
    secretVersion: 1,
  });

  expect(worldmapSecret).not.toStrictEqual(otherSecret);
});

test('it derives a different secret for a different avatar ID', () => {
  const secret1 = deriveScopeSecret({
    root,
    secretRef: 'worldmap',
    avatarID: 'avatar_1',
    secretVersion: 1,
  });

  const secret2 = deriveScopeSecret({
    root,
    secretRef: 'worldmap',
    avatarID: 'avatar_2',
    secretVersion: 1,
  });

  expect(secret1).not.toStrictEqual(secret2);
});

test('it derives a different secret for a different secret version', () => {
  const secretV1 = deriveScopeSecret({
    root,
    secretRef: 'worldmap',
    avatarID: 'avatar_1',
    secretVersion: 1,
  });

  const secretV2 = deriveScopeSecret({
    root,
    secretRef: 'worldmap',
    avatarID: 'avatar_1',
    secretVersion: 2,
  });

  expect(secretV1).not.toStrictEqual(secretV2);
});

test('it derives a 32-byte secret', () => {
  const secret = deriveScopeSecret({
    root,
    secretRef: 'worldmap',
    avatarID: 'avatar_1',
    secretVersion: 1,
  });

  expect(secret).toHaveLength(32);
});

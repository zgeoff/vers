import { expect, test } from 'bun:test';
import { bytesToHex } from '@noble/hashes/utils.js';
import { deriveWorldmapDescriptor } from './derive-worldmap-descriptor';

const scopeSecret = new Uint8Array(32).fill(0x0b);

test('it derives a frozen golden descriptor from fixed inputs', () => {
  const descriptor = deriveWorldmapDescriptor({ coord: [3, -2], scopeSecret, userSeed: 0 });

  expect(bytesToHex(descriptor)).toMatchInlineSnapshot(
    `"900f266547490349828b49daebb52a97fae66fe4b470e656f88fdb8c1c1063dc"`,
  );
});

test('it derives bit-identical descriptors for identical input', () => {
  const input = { coord: [3, -2], scopeSecret, userSeed: 0 } as const;

  expect(deriveWorldmapDescriptor(input)).toStrictEqual(deriveWorldmapDescriptor(input));
});

test('it derives a different descriptor for a different scope secret', () => {
  const otherSecret = new Uint8Array(32).fill(0x0c);

  const first = deriveWorldmapDescriptor({ coord: [3, -2], scopeSecret, userSeed: 0 });

  const second = deriveWorldmapDescriptor({
    coord: [3, -2],
    scopeSecret: otherSecret,
    userSeed: 0,
  });

  expect(first).not.toStrictEqual(second);
});

test('it derives a different descriptor for a different coordinate', () => {
  const first = deriveWorldmapDescriptor({ coord: [3, -2], scopeSecret, userSeed: 0 });
  const second = deriveWorldmapDescriptor({ coord: [4, -2], scopeSecret, userSeed: 0 });

  expect(first).not.toStrictEqual(second);
});

test('it derives a different descriptor for a different userSeed', () => {
  const first = deriveWorldmapDescriptor({ coord: [3, -2], scopeSecret, userSeed: 0 });
  const second = deriveWorldmapDescriptor({ coord: [3, -2], scopeSecret, userSeed: 1 });

  expect(first).not.toStrictEqual(second);
});

test('it derives a 32-byte descriptor', () => {
  const descriptor = deriveWorldmapDescriptor({ coord: [3, -2], scopeSecret, userSeed: 0 });

  expect(descriptor).toHaveLength(32);
});

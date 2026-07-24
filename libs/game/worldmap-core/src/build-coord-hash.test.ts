import { expect, test } from 'bun:test';
import { HASH_CHANNEL, buildCoordHash, buildCoordHashUnit } from './build-coord-hash';

test('it returns the same value for the same inputs', () => {
  expect(buildCoordHash(42, 3, -7, HASH_CHANNEL.jitterX)).toBe(
    buildCoordHash(42, 3, -7, HASH_CHANNEL.jitterX),
  );
});

test('it stays within the uint32 range', () => {
  for (let cx = -4; cx <= 4; cx++) {
    for (let cy = -4; cy <= 4; cy++) {
      const value = buildCoordHash(1, cx, cy, HASH_CHANNEL.jitterX);

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(value)).toBe(true);
    }
  }
});

test('it decorrelates the draw channels for one cell', () => {
  expect(buildCoordHash(1, 2, 3, HASH_CHANNEL.jitterX)).not.toBe(
    buildCoordHash(1, 2, 3, HASH_CHANNEL.jitterY),
  );
});

test('it decorrelates neighbouring cells under one seed', () => {
  expect(buildCoordHash(1, 0, 0, HASH_CHANNEL.jitterX)).not.toBe(
    buildCoordHash(1, 1, 0, HASH_CHANNEL.jitterX),
  );
});

test('it moves with the avatar seed', () => {
  expect(buildCoordHash(1, 5, 5, HASH_CHANNEL.jitterX)).not.toBe(
    buildCoordHash(2, 5, 5, HASH_CHANNEL.jitterX),
  );
});

test('it maps to the half-open unit interval', () => {
  const unit = buildCoordHashUnit(9, -3, 8, HASH_CHANNEL.jitterY);

  expect(unit).toBeGreaterThanOrEqual(0);
  expect(unit).toBeLessThan(1);
});

test('it draws a stable sequence for a fixed seed', () => {
  const draws = [
    buildCoordHash(7, 0, 0, HASH_CHANNEL.jitterX),
    buildCoordHash(7, 0, 0, HASH_CHANNEL.jitterY),
    buildCoordHash(7, 1, 0, HASH_CHANNEL.jitterX),
    buildCoordHash(7, 0, 1, HASH_CHANNEL.jitterX),
    buildCoordHash(7, -1, -1, HASH_CHANNEL.jitterY),
  ];

  expect(draws).toMatchInlineSnapshot(`
    [
      3589541006,
      2630369547,
      675780315,
      2031336951,
      2418359163,
    ]
  `);
});

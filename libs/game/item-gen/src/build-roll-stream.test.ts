import { expect, test } from 'bun:test';
import { buildRollStream } from './build-roll-stream';

test('it reproduces the frozen golden byte sequence for a fixed seed and domain', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const draws = Array.from({ length: 8 }, () => stream.rollRange(0, 255));

  expect(draws).toStrictEqual([195, 28, 221, 36, 227, 214, 183, 60]);
});

test('it reproduces the frozen golden dice sequence for a narrow range', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const draws = Array.from({ length: 6 }, () => stream.rollRange(1, 6));

  expect(draws).toStrictEqual([4, 5, 6, 1, 6, 5]);
});

test('it reproduces the frozen golden sequence for a two-byte span', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const draws = Array.from({ length: 4 }, () => stream.rollRange(0, 9999));

  expect(draws).toStrictEqual([9948, 6612, 8326, 6908]);
});

test('it yields identical draws for equal seed and domain', () => {
  const first = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const second = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(Array.from({ length: 16 }, () => first.rollRange(0, 9999))).toStrictEqual(
    Array.from({ length: 16 }, () => second.rollRange(0, 9999)),
  );
});

test('it diverges across domains for the same seed', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'other/domain',
  );

  const draws = Array.from({ length: 4 }, () => stream.rollRange(0, 255));

  expect(draws).toStrictEqual([200, 5, 175, 147]);
  expect(draws).not.toStrictEqual([195, 28, 221, 36]);
});

test('it keeps every draw inside the requested range', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const draws = Array.from({ length: 1000 }, () => stream.rollRange(3, 17));

  expect(draws).toSatisfyAll((draw: number) => Number.isInteger(draw) && draw >= 3 && draw <= 17);
});

test('it consumes no bytes for a degenerate range', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(stream.rollRange(5, 5)).toBe(5);
  expect(stream.rollRange(0, 255)).toBe(195);
});

test('it reproduces the frozen golden weighted picks for even weights', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const picks = Array.from({ length: 8 }, () =>
    stream.pickWeighted([
      { value: 'a', weight: 1 },
      { value: 'b', weight: 1 },
    ]),
  );

  expect(picks).toStrictEqual(['b', 'a', 'b', 'a', 'b', 'a', 'b', 'a']);
});

test('it lands weighted picks proportionally to skewed weights', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  const picks = Array.from({ length: 8 }, () =>
    stream.pickWeighted([
      { value: 'a', weight: 9 },
      { value: 'b', weight: 1 },
    ]),
  );

  expect(picks).toStrictEqual(['a', 'a', 'a', 'a', 'a', 'a', 'a', 'a']);
});

test('it rejects an inverted range', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(() => stream.rollRange(2, 1)).toThrowWithMessage(Error, /range min must not exceed max/);
});

test('it rejects a span above 2^32', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(() => stream.rollRange(0, 2 ** 32)).toThrowWithMessage(
    Error,
    /range span must not exceed 2\^32/,
  );
});

test('it rejects non-integer bounds', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(() => stream.rollRange(0.5, 2)).toThrowWithMessage(
    Error,
    /range min must be a safe integer/,
  );

  expect(() => stream.rollRange(0, 1.5)).toThrowWithMessage(
    Error,
    /range max must be a safe integer/,
  );
});

test('it rejects an empty weighted pick', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(() => stream.pickWeighted([])).toThrowWithMessage(
    Error,
    /weighted pick needs at least one entry/,
  );
});

test('it rejects zero and fractional weights', () => {
  const stream = buildRollStream(
    Uint8Array.from({ length: 32 }, (_, i) => i),
    'test/domain',
  );

  expect(() => stream.pickWeighted([{ value: 'a', weight: 0 }])).toThrowWithMessage(
    Error,
    /weights must be integers of at least 1/,
  );

  expect(() => stream.pickWeighted([{ value: 'a', weight: 1.5 }])).toThrowWithMessage(
    Error,
    /weights must be integers of at least 1/,
  );
});

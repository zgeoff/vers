import { expect, test } from 'bun:test';
import { hexToBytes } from '@noble/hashes/utils.js';
import { buildPositionStream } from './build-position-stream';

test('it reproduces the frozen golden draws for a reward coordinate', () => {
  const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 0,
  });

  const draws = Array.from({ length: 4 }, () => stream.rollRange(0, 9999));

  expect(draws).toMatchInlineSnapshot(`
    [
      9644,
      2641,
      3318,
      1744,
    ]
  `);
});

test('it reproduces the frozen golden draws for a craft position', () => {
  const stream = buildPositionStream(hexToBytes('11'.repeat(32)), {
    kind: 'craft',
    avatarID: 'avatar-1',
    position: 3,
  });

  const draws = Array.from({ length: 4 }, () => stream.rollRange(0, 9999));

  expect(draws).toMatchInlineSnapshot(`
    [
      4500,
      4851,
      6330,
      8490,
    ]
  `);
});

test('it reproduces identical draws when rebuilt from equal inputs', () => {
  const position = {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 7,
  } as const;

  const first = buildPositionStream(hexToBytes('11'.repeat(32)), position);
  const second = buildPositionStream(hexToBytes('11'.repeat(32)), position);

  expect(Array.from({ length: 16 }, () => first.rollRange(0, 9999))).toStrictEqual(
    Array.from({ length: 16 }, () => second.rollRange(0, 9999)),
  );
});

test('it rejects an empty key', () => {
  expect(() =>
    buildPositionStream(new Uint8Array(0), { kind: 'craft', avatarID: 'a', position: 1 }),
  ).toThrowWithMessage(Error, /avatar key must not be empty/);
});

test('it diverges under a different key', () => {
  const position = {
    kind: 'reward',
    avatarID: 'avatar-1',
    scopeType: 'world_map_node',
    scopeID: 'node-1',
    chainIndex: 3,
    ordinal: 0,
  } as const;

  const first = buildPositionStream(hexToBytes('11'.repeat(32)), position);
  const second = buildPositionStream(hexToBytes('22'.repeat(32)), position);

  expect(Array.from({ length: 4 }, () => second.rollRange(0, 9999))).not.toStrictEqual(
    Array.from({ length: 4 }, () => first.rollRange(0, 9999)),
  );
});

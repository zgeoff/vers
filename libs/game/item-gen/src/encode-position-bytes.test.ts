import { expect, test } from 'bun:test';
import { encodePositionBytes } from './encode-position-bytes';

test('it encodes a reward coordinate to the frozen field layout', () => {
  const bytes = encodePositionBytes({
    kind: 'reward',
    avatarID: 'avatar-1',
    nodeID: 'node-1',
    chainIndex: 3,
    ordinal: 0,
  });

  expect(new TextDecoder().decode(bytes)).toBe('vers/roll-position/v1|reward|avatar-1|node-1|3|0');
});

test('it encodes a craft position to the frozen field layout', () => {
  const bytes = encodePositionBytes({ kind: 'craft', avatarID: 'avatar-1', position: 3 });

  expect(new TextDecoder().decode(bytes)).toBe('vers/roll-position/v1|craft|avatar-1|3');
});

test('it never collides a craft position with a reward coordinate', () => {
  const craft = encodePositionBytes({ kind: 'craft', avatarID: 'a', position: 1 });

  const reward = encodePositionBytes({
    kind: 'reward',
    avatarID: 'a',
    nodeID: '1',
    chainIndex: 1,
    ordinal: 1,
  });

  expect(new TextDecoder().decode(craft)).not.toBe(new TextDecoder().decode(reward));
});

test('it rejects an identifier containing the separator', () => {
  expect(() =>
    encodePositionBytes({ kind: 'craft', avatarID: 'a|b', position: 1 }),
  ).toThrowWithMessage(Error, /avatarID must not contain the separator/);
});

test('it rejects a negative position index', () => {
  expect(() =>
    encodePositionBytes({ kind: 'craft', avatarID: 'a', position: -1 }),
  ).toThrowWithMessage(Error, /craft position must be a non-negative integer/);
});

test('it rejects a node identifier containing the separator', () => {
  expect(() =>
    encodePositionBytes({
      kind: 'reward',
      avatarID: 'a',
      nodeID: 'n|1',
      chainIndex: 1,
      ordinal: 0,
    }),
  ).toThrowWithMessage(Error, /nodeID must not contain the separator/);
});

test('it rejects a negative chain index', () => {
  expect(() =>
    encodePositionBytes({ kind: 'reward', avatarID: 'a', nodeID: 'n', chainIndex: -1, ordinal: 0 }),
  ).toThrowWithMessage(Error, /chainIndex must be a non-negative integer/);
});

test('it rejects an identifier with malformed unicode', () => {
  expect(() =>
    encodePositionBytes({ kind: 'craft', avatarID: 'a\uD800b', position: 1 }),
  ).toThrowWithMessage(Error, /avatarID must be well-formed unicode/);
});

test('it rejects a fractional ordinal', () => {
  expect(() =>
    encodePositionBytes({
      kind: 'reward',
      avatarID: 'a',
      nodeID: 'n',
      chainIndex: 1,
      ordinal: 0.5,
    }),
  ).toThrowWithMessage(Error, /ordinal must be a non-negative integer/);
});

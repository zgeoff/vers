import { expect, test } from 'bun:test';
import { parseRollKeyRoots } from './parse-roll-key-roots';

test('it parses a valid two-population payload into decoded roots', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: '22'.repeat(32) } },
    trade: { current: 1, roots: { 1: '11'.repeat(32) } },
  });

  const roots = parseRollKeyRoots(payload);

  expect(roots.trade.current).toBe(1);
  expect(roots.trade.roots.get(1)).toStrictEqual(new Uint8Array(32).fill(0x11));
  expect(roots['self-found'].roots.get(1)).toStrictEqual(new Uint8Array(32).fill(0x22));
});

test('it rejects malformed JSON', () => {
  expect(() => parseRollKeyRoots('not json')).toThrowWithMessage(Error, /malformed JSON/u);
});

test('it rejects a payload missing the self-found population', () => {
  const payload = JSON.stringify({ trade: { current: 1, roots: { 1: '11'.repeat(32) } } });

  expect(() => parseRollKeyRoots(payload)).toThrow();
});

test('it rejects a root that is not 64-character hex', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: '22'.repeat(32) } },
    trade: { current: 1, roots: { 1: 'not-hex' } },
  });

  expect(() => parseRollKeyRoots(payload)).toThrowWithMessage(Error, /64-character hex/u);
});

test('it rejects a non-integer key version', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: '22'.repeat(32) } },
    trade: { current: 1, roots: { abc: '11'.repeat(32) } },
  });

  expect(() => parseRollKeyRoots(payload)).toThrowWithMessage(Error, /non-integer key version/u);
});

test('it rejects a current version absent from roots', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: '22'.repeat(32) } },
    trade: { current: 2, roots: { 1: '11'.repeat(32) } },
  });

  expect(() => parseRollKeyRoots(payload)).toThrowWithMessage(Error, /no matching root/u);
});

test('it never echoes root material in a rejection message', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: '22'.repeat(32) } },
    trade: { current: 1, roots: { 1: 'not-hex-but-secret-shaped' } },
  });

  expect(() => parseRollKeyRoots(payload)).toThrowWithMessage(
    Error,
    /population "trade" key version 1 is not 64-character hex/u,
  );

  expect(() => parseRollKeyRoots(payload)).not.toThrowWithMessage(
    Error,
    /not-hex-but-secret-shaped/u,
  );

  expect(() => parseRollKeyRoots(payload)).not.toThrowWithMessage(
    Error,
    new RegExp('22'.repeat(32), 'u'),
  );
});

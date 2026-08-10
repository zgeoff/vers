import { expect, test } from 'bun:test';
import { parseRollKeyRoots } from './parse-roll-key-roots';

const TRADE_ROOT = '11'.repeat(32);
const SELF_FOUND_ROOT = '22'.repeat(32);

test('it parses a valid two-population payload into decoded roots', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: SELF_FOUND_ROOT } },
    trade: { current: 1, roots: { 1: TRADE_ROOT } },
  });

  const roots = parseRollKeyRoots(payload);

  expect(roots.trade.current).toBe(1);
  expect(roots.trade.roots.get(1)).toStrictEqual(Uint8Array.from(Buffer.from(TRADE_ROOT, 'hex')));

  expect(roots['self-found'].roots.get(1)).toStrictEqual(
    Uint8Array.from(Buffer.from(SELF_FOUND_ROOT, 'hex')),
  );
});

test('it rejects malformed JSON', () => {
  expect(() => parseRollKeyRoots('not json')).toThrowWithMessage(Error, /malformed JSON/);
});

test('it rejects a payload missing the self-found population', () => {
  const payload = JSON.stringify({ trade: { current: 1, roots: { 1: TRADE_ROOT } } });

  expect(() => parseRollKeyRoots(payload)).toThrow();
});

test('it rejects a root that is not 64-character hex', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: SELF_FOUND_ROOT } },
    trade: { current: 1, roots: { 1: 'not-hex' } },
  });

  expect(() => parseRollKeyRoots(payload)).toThrowWithMessage(Error, /64-character hex/);
});

test('it rejects a non-integer key version', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: SELF_FOUND_ROOT } },
    trade: { current: 1, roots: { abc: TRADE_ROOT } },
  });

  expect(() => parseRollKeyRoots(payload)).toThrowWithMessage(Error, /non-integer key version/);
});

test('it rejects a current version absent from roots', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: SELF_FOUND_ROOT } },
    trade: { current: 2, roots: { 1: TRADE_ROOT } },
  });

  expect(() => parseRollKeyRoots(payload)).toThrowWithMessage(Error, /no matching root/);
});

test('it never echoes root material in a rejection message', () => {
  const payload = JSON.stringify({
    'self-found': { current: 1, roots: { 1: SELF_FOUND_ROOT } },
    trade: { current: 1, roots: { 1: 'not-hex-but-secret-shaped' } },
  });

  expect(() => parseRollKeyRoots(payload)).toThrowWithMessage(
    Error,
    'invalid ROLL_KEY_ROOTS: population "trade" key version 1 is not 64-character hex',
  );
});

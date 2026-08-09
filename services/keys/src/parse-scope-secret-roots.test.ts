import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { parseScopeSecretRoots } from './parse-scope-secret-roots';

const WORLDMAP_ROOT = '11'.repeat(32);

test('it parses a valid payload into decoded roots', () => {
  const payload = JSON.stringify({
    worldmap: { current: 1, roots: { 1: WORLDMAP_ROOT } },
  });

  const roots = parseScopeSecretRoots(payload);

  expect(roots.worldmap.current).toBe(1);

  expect(roots.worldmap.roots.get(1)).toStrictEqual(
    Uint8Array.from(Buffer.from(WORLDMAP_ROOT, 'hex')),
  );
});

test('it rejects malformed JSON', () => {
  expect(() => parseScopeSecretRoots('not json')).toThrowWithMessage(Error, /malformed JSON/);
});

test('it rejects a payload missing the worldmap scope', () => {
  const payload = JSON.stringify({});

  expect(() => parseScopeSecretRoots(payload)).toThrow();
});

test('it rejects a root that is not 64-character hex', () => {
  const payload = JSON.stringify({
    worldmap: { current: 1, roots: { 1: 'not-hex' } },
  });

  expect(() => parseScopeSecretRoots(payload)).toThrowWithMessage(Error, /64-character hex/);
});

test('it rejects a non-integer secret version', () => {
  const payload = JSON.stringify({
    worldmap: { current: 1, roots: { abc: WORLDMAP_ROOT } },
  });

  expect(() => parseScopeSecretRoots(payload)).toThrowWithMessage(
    Error,
    /non-integer secret version/,
  );
});

test('it rejects a current version absent from roots', () => {
  const payload = JSON.stringify({
    worldmap: { current: 2, roots: { 1: WORLDMAP_ROOT } },
  });

  expect(() => parseScopeSecretRoots(payload)).toThrowWithMessage(Error, /no matching root/);
});

test('it never echoes root material in a rejection message', () => {
  const payload = JSON.stringify({
    worldmap: { current: 1, roots: { 1: 'not-hex-but-secret-shaped' } },
  });

  let thrown: unknown;

  try {
    parseScopeSecretRoots(payload);
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof Error);

  expect(thrown.message).not.toInclude('not-hex-but-secret-shaped');
});

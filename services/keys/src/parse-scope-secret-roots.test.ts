import { expect, test } from 'bun:test';
import { parseScopeSecretRoots } from './parse-scope-secret-roots';

test('it parses a valid payload into decoded roots', () => {
  const payload = JSON.stringify({
    worldmap: { current: 1, roots: { 1: '11'.repeat(32) } },
  });

  const roots = parseScopeSecretRoots(payload);

  expect(roots.worldmap.current).toBe(1);
  expect(roots.worldmap.roots.get(1)).toStrictEqual(new Uint8Array(32).fill(0x11));
});

test('it rejects malformed JSON', () => {
  expect(() => parseScopeSecretRoots('not json')).toThrowWithMessage(Error, /malformed JSON/u);
});

test('it rejects a payload missing the worldmap scope', () => {
  const payload = JSON.stringify({});

  expect(() => parseScopeSecretRoots(payload)).toThrow();
});

test('it rejects a root that is not 64-character hex', () => {
  const payload = JSON.stringify({
    worldmap: { current: 1, roots: { 1: 'not-hex' } },
  });

  expect(() => parseScopeSecretRoots(payload)).toThrowWithMessage(Error, /64-character hex/u);
});

test('it rejects a non-integer secret version', () => {
  const payload = JSON.stringify({
    worldmap: { current: 1, roots: { abc: '11'.repeat(32) } },
  });

  expect(() => parseScopeSecretRoots(payload)).toThrowWithMessage(
    Error,
    /non-integer secret version/u,
  );
});

test('it rejects a current version absent from roots', () => {
  const payload = JSON.stringify({
    worldmap: { current: 2, roots: { 1: '11'.repeat(32) } },
  });

  expect(() => parseScopeSecretRoots(payload)).toThrowWithMessage(Error, /no matching root/u);
});

test('it never echoes root material in a rejection message', () => {
  const payload = JSON.stringify({
    worldmap: { current: 1, roots: { 1: 'not-hex-but-secret-shaped' } },
  });

  expect(() => parseScopeSecretRoots(payload)).toThrowWithMessage(
    Error,
    /scope "worldmap" secret version 1 is not 64-character hex/u,
  );

  expect(() => parseScopeSecretRoots(payload)).not.toThrowWithMessage(
    Error,
    /not-hex-but-secret-shaped/u,
  );
});

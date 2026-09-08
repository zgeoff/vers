import { expect, test } from 'bun:test';
import { bytesToHex } from '@noble/hashes/utils.js';
import { parseKeyRoots } from './parse-key-roots';

test('it picks the root each stamped version derives against', () => {
  const parsed = parseKeyRoots(
    {
      rollKeyRoots: JSON.stringify({
        'self-found': { current: 1, roots: { '1': 'cc'.repeat(32) } },
        trade: { current: 2, roots: { '1': 'aa'.repeat(32), '2': 'bb'.repeat(32) } },
      }),
      scopeSecretRoots: JSON.stringify({
        worldmap: { current: 1, roots: { '1': 'dd'.repeat(32) } },
      }),
    },
    { keyVersion: 1, secretVersion: 1 },
  );

  expect(bytesToHex(parsed.rollKeyRoot)).toBe('aa'.repeat(32));
  expect(bytesToHex(parsed.scopeSecretRoot)).toBe('dd'.repeat(32));
});

test('it rejects roots that have no entry for the stamped version', () => {
  expect(() =>
    parseKeyRoots(
      {
        rollKeyRoots: JSON.stringify({ trade: { current: 2, roots: { '2': 'bb'.repeat(32) } } }),
        scopeSecretRoots: JSON.stringify({
          worldmap: { current: 1, roots: { '1': 'dd'.repeat(32) } },
        }),
      },
      { keyVersion: 1, secretVersion: 1 },
    ),
  ).toThrowWithMessage(Error, /ROLL_KEY_ROOTS has no "trade" root for version 1/);
});

test('it rejects a root that is not 64-character hex, even one it would not pick', () => {
  expect(() =>
    parseKeyRoots(
      {
        rollKeyRoots: JSON.stringify({ trade: { current: 1, roots: { '1': 'aa'.repeat(32) } } }),
        scopeSecretRoots: JSON.stringify({
          worldmap: { current: 1, roots: { '1': 'dd'.repeat(32), '2': 'short' } },
        }),
      },
      { keyVersion: 1, secretVersion: 1 },
    ),
  ).toThrowWithMessage(Error, /invalid SCOPE_SECRET_ROOTS: .*64-character hex/s);
});

test('it rejects an entry whose current version has no root', () => {
  expect(() =>
    parseKeyRoots(
      {
        rollKeyRoots: JSON.stringify({ trade: { current: 3, roots: { '1': 'aa'.repeat(32) } } }),
        scopeSecretRoots: JSON.stringify({
          worldmap: { current: 1, roots: { '1': 'dd'.repeat(32) } },
        }),
      },
      { keyVersion: 1, secretVersion: 1 },
    ),
  ).toThrowWithMessage(Error, /"trade" current version 3 has no matching root/);
});

test('it rejects an entry without a current version', () => {
  expect(() =>
    parseKeyRoots(
      {
        rollKeyRoots: JSON.stringify({ trade: { roots: { '1': 'aa'.repeat(32) } } }),
        scopeSecretRoots: JSON.stringify({
          worldmap: { current: 1, roots: { '1': 'dd'.repeat(32) } },
        }),
      },
      { keyVersion: 1, secretVersion: 1 },
    ),
  ).toThrowWithMessage(Error, /invalid ROLL_KEY_ROOTS: .*current/s);
});

test('it rejects malformed JSON', () => {
  expect(() =>
    parseKeyRoots(
      {
        rollKeyRoots: '{',
        scopeSecretRoots: JSON.stringify({
          worldmap: { current: 1, roots: { '1': 'dd'.repeat(32) } },
        }),
      },
      { keyVersion: 1, secretVersion: 1 },
    ),
  ).toThrowWithMessage(Error, /invalid ROLL_KEY_ROOTS: malformed JSON/);
});

test('it rejects a payload missing the worldmap scope', () => {
  expect(() =>
    parseKeyRoots(
      {
        rollKeyRoots: JSON.stringify({ trade: { current: 1, roots: { '1': 'aa'.repeat(32) } } }),
        scopeSecretRoots: JSON.stringify({}),
      },
      { keyVersion: 1, secretVersion: 1 },
    ),
  ).toThrowWithMessage(Error, /invalid SCOPE_SECRET_ROOTS/);
});

import { expect, test } from 'bun:test';
import { buildStartHash } from './build-start-hash';

test('it builds a deterministic hex digest for a given input', () => {
  const input = {
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash(input)).toBe(buildStartHash(input));
});

test('it produces different hashes for different seeds', () => {
  const input = {
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash({ ...input, seed: 'seed_0' })).not.toBe(
    buildStartHash({ ...input, seed: 'seed_1' }),
  );
});

test('it produces different hashes for different key versions', () => {
  const input = {
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash({ ...input, keyVersion: 1 })).not.toBe(
    buildStartHash({ ...input, keyVersion: 2 }),
  );
});

test('it produces different hashes for different encounter node difficulties', () => {
  const input = {
    contentVersion: '0.0.0-dev',
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  };

  expect(buildStartHash({ ...input, encounterNode: { difficulty: 1 } })).not.toBe(
    buildStartHash({ ...input, encounterNode: { difficulty: 2 } }),
  );
});

test('it produces a 64-character hex digest', () => {
  const hash = buildStartHash({
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  });

  expect(hash).toMatch(/^[a-f0-9]{64}$/);
});

test('it derives the frozen canonical digest for a known input', () => {
  const hash = buildStartHash({
    contentVersion: '0.0.0-dev',
    encounterNode: { difficulty: 1 },
    keyVersion: 1,
    seed: 'seed_0',
    simVersion: '0.0.0-dev',
  });

  expect(hash).toMatchInlineSnapshot(
    `"31f2c78bcc35eb015d8e2bad425ab9dd54770b0614095a2b262f1a64d2801ca8"`,
  );
});

import { expect, test } from 'bun:test';
import { buildCheckpointHash } from './build-checkpoint-hash';

test('it builds a deterministic hex digest for a given input', () => {
  const input = {
    entropySource: 'chain',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  };

  expect(buildCheckpointHash({ ...input, version: 1 })).toBe(
    buildCheckpointHash({ ...input, version: 1 }),
  );
});

test('it produces different hashes for different versions', () => {
  const input = {
    entropySource: 'chain',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
  };

  expect(buildCheckpointHash({ ...input, version: 1 })).not.toBe(
    buildCheckpointHash({ ...input, version: 2 }),
  );
});

test('it produces different hashes for different entropy sources', () => {
  const input = {
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
    version: 1,
  };

  expect(buildCheckpointHash({ ...input, entropySource: 'chain' })).not.toBe(
    buildCheckpointHash({ ...input, entropySource: 'beacon' }),
  );
});

test('it produces a 64-character hex digest', () => {
  const hash = buildCheckpointHash({
    entropySource: 'chain',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
    version: 1,
  });

  expect(hash).toMatch(/^[a-f0-9]{64}$/);
});

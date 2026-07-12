import { expect, test } from 'bun:test';
import { buildCheckpointHash } from './build-checkpoint-hash';

test('it builds a deterministic hex digest for a given input', () => {
  const input = {
    chainIndex: 1,
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
    chainIndex: 1,
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

test('it produces different hashes for different chain indices', () => {
  const input = {
    entropySource: 'chain',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
    version: 1,
  };

  expect(buildCheckpointHash({ ...input, chainIndex: 1 })).not.toBe(
    buildCheckpointHash({ ...input, chainIndex: 2 }),
  );
});

test('it produces different hashes for different entropy sources', () => {
  const input = {
    chainIndex: 1,
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
    chainIndex: 1,
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

test('it derives the frozen canonical digest for a known input', () => {
  const hash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'chain',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
    version: 1,
  });

  expect(hash).toBe('a2a741f37fd2cffb06c6b5e1ad737106670c1203d89206040b5260de4b632408');
});

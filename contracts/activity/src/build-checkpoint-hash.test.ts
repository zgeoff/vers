import { expect, test } from 'bun:test';
import { buildCheckpointHash } from './build-checkpoint-hash';

test('it builds a deterministic hex digest for a given input', () => {
  const input = {
    chainIndex: 1,
    entropySource: 'server-key',
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
    entropySource: 'server-key',
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
    entropySource: 'server-key',
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

  expect(buildCheckpointHash({ ...input, entropySource: 'server-key' })).not.toBe(
    buildCheckpointHash({ ...input, entropySource: 'device-key' }),
  );
});

test('it produces a 64-character hex digest', () => {
  const hash = buildCheckpointHash({
    chainIndex: 1,
    entropySource: 'server-key',
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
    entropySource: 'server-key',
    nextSeed: 'seed_1',
    prevHash: 'hash_0',
    seed: 'seed_0',
    time: 12,
    type: 'tick',
    version: 1,
  });

  expect(hash).toBe('c51bad8035095b3d570dd972bd05c7a686b403b2f7db11dbe0fc83e6e9e4150e');
});

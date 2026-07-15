import { expect, test } from 'bun:test';
import { buildSegmentDuration } from './build-segment-duration';
import type { StoredCheckpoint } from './types';

function buildCheckpoint(overrides: Partial<StoredCheckpoint> = {}): StoredCheckpoint {
  return {
    hash: 'hash',
    payload: {
      chainIndex: 1,
      entropySource: 'server-key',
      nextSeed: 'bb',
      seed: 'aa',
      time: 0,
      type: 'started',
    },
    prevHash: 'prev',
    version: 1,
    ...overrides,
  };
}

test('it sums a single local attempt to its terminal checkpoint plus grace', () => {
  const checkpoints = [
    buildCheckpoint({
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        nextSeed: 'bb',
        seed: 'aa',
        time: 0,
        type: 'started',
      },
      version: 1,
    }),
    buildCheckpoint({
      payload: {
        chainIndex: 2,
        entropySource: 'server-key',
        nextSeed: 'cc',
        seed: 'bb',
        time: 5000,
        type: 'completed',
      },
      version: 2,
    }),
  ];

  expect(buildSegmentDuration(checkpoints)).toBe(5000 + 60_000);
});

test('it resets the running total across an engine restart boundary', () => {
  const checkpoints = [
    buildCheckpoint({
      payload: {
        chainIndex: 1,
        entropySource: 'server-key',
        nextSeed: 'bb',
        seed: 'aa',
        time: 0,
        type: 'started',
      },
      version: 1,
    }),
    buildCheckpoint({
      payload: {
        chainIndex: 2,
        entropySource: 'server-key',
        nextSeed: 'cc',
        seed: 'bb',
        time: 5000,
        type: 'completed',
      },
      version: 2,
    }),
    buildCheckpoint({
      payload: {
        chainIndex: 3,
        entropySource: 'server-key',
        nextSeed: 'dd',
        seed: 'cc',
        time: 0,
        type: 'started',
      },
      version: 3,
    }),
    buildCheckpoint({
      payload: {
        chainIndex: 4,
        entropySource: 'server-key',
        nextSeed: 'ee',
        seed: 'dd',
        time: 3000,
        type: 'progress',
      },
      version: 4,
    }),
  ];

  expect(buildSegmentDuration(checkpoints)).toBe(5000 + 3000 + 60_000);
});

test('it reports only the grace margin for an empty run', () => {
  expect(buildSegmentDuration([])).toBe(60_000);
});

import { expect, test } from 'bun:test';
import { createMockCatchUpContinuation } from '@vers/contract-activity/test-utils';
import { splitContinuationsIntoBatches } from './split-continuations-into-batches';

test('it keeps every continuation in one batch when the total fits the cap', () => {
  const continuations = [
    createMockCatchUpContinuation({ checkpointCount: 2 }),
    createMockCatchUpContinuation({ checkpointCount: 2 }),
  ];

  expect(splitContinuationsIntoBatches(continuations, 10)).toStrictEqual([continuations]);
});

test('it starts a new batch once the running checkpoint count would exceed the cap', () => {
  const first = createMockCatchUpContinuation({ checkpointCount: 3 });
  const second = createMockCatchUpContinuation({ checkpointCount: 3 });
  const third = createMockCatchUpContinuation({ checkpointCount: 3 });

  expect(splitContinuationsIntoBatches([first, second, third], 5)).toStrictEqual([
    [first],
    [second],
    [third],
  ]);
});

test('it packs continuations up to the cap before splitting', () => {
  const first = createMockCatchUpContinuation({ checkpointCount: 2 });
  const second = createMockCatchUpContinuation({ checkpointCount: 2 });
  const third = createMockCatchUpContinuation({ checkpointCount: 2 });

  expect(splitContinuationsIntoBatches([first, second, third], 4)).toStrictEqual([
    [first, second],
    [third],
  ]);
});

test('it gives a continuation whose own checkpoint count exceeds the cap a batch to itself', () => {
  const oversized = createMockCatchUpContinuation({ checkpointCount: 10 });
  const next = createMockCatchUpContinuation({ checkpointCount: 1 });

  expect(splitContinuationsIntoBatches([oversized, next], 5)).toStrictEqual([[oversized], [next]]);
});

test('it returns no batches for an empty continuation list', () => {
  expect(splitContinuationsIntoBatches([], 10)).toStrictEqual([]);
});

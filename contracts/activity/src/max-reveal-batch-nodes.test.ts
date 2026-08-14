import { expect, test } from 'bun:test';
import { MAX_REVEAL_BATCH_NODES } from './max-reveal-batch-nodes';

test('it bounds a reveal batch to 256 nodes', () => {
  expect(MAX_REVEAL_BATCH_NODES).toBe(256);
});

import { expect, test } from 'bun:test';
import { MAX_CATCH_UP_BATCH_CHECKPOINTS } from './max-catch-up-batch-checkpoints';

test('it bounds a catch-up batch to 500 checkpoints', () => {
  expect(MAX_CATCH_UP_BATCH_CHECKPOINTS).toBe(500);
});

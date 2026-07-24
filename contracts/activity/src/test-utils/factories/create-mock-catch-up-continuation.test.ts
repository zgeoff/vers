import { expect, test } from 'bun:test';
import { CatchUpContinuationSchema } from '../../catch-up-continuation-schema';
import { createMockCatchUpContinuation } from './create-mock-catch-up-continuation';

test('it builds a contract-valid continuation by default', () => {
  const continuation = createMockCatchUpContinuation();

  expect(CatchUpContinuationSchema.parse(continuation)).toStrictEqual(continuation);
  expect(continuation.checkpoints).toHaveLength(1);
});

test('it builds the requested number of checkpoint entries', () => {
  const continuation = createMockCatchUpContinuation({ checkpointCount: 3 });

  expect(continuation.checkpoints).toHaveLength(3);
  expect(continuation.checkpoints.map((checkpoint) => checkpoint.version)).toStrictEqual([1, 2, 3]);
});

test('it applies overrides over the defaults', () => {
  const continuation = createMockCatchUpContinuation({
    id: 'act_fixed',
    startKey: 'continue_fixed',
  });

  expect(continuation.id).toBe('act_fixed');
  expect(continuation.startKey).toBe('continue_fixed');
});

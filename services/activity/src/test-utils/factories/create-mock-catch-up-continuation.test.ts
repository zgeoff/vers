import { expect, test } from 'bun:test';
import { createMockCatchUpContinuation } from './create-mock-catch-up-continuation';

test('it builds a single-entry terminal tail whose xp matches the snapshot hint', () => {
  const continuation = createMockCatchUpContinuation();

  expect(continuation.checkpoints).toHaveLength(1);

  expect(continuation.checkpoints[0]?.payload).toMatchObject({
    rewards: { xp: continuation.buildSnapshot.xp },
    type: 'completed',
  });

  expect(continuation.id).toStartWith('act_');
  expect(continuation.startKey).toStartWith('continue_');
});

test('it applies overrides over the defaults', () => {
  const continuation = createMockCatchUpContinuation({
    buildSnapshot: { level: 3, xp: 450 },
    id: 'act_custom',
    startKey: 'continue_custom',
  });

  expect(continuation).toMatchObject({
    buildSnapshot: { level: 3, xp: 450 },
    id: 'act_custom',
    startKey: 'continue_custom',
  });
});

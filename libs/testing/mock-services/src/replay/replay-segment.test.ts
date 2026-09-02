import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { createMockReplaySegmentInput } from '@vers/contract-replay/test-utils';
import { replaySegment } from './replay-segment';

test('it replays any segment as a canned empty success', async () => {
  const result = await call(replaySegment, createMockReplaySegmentInput(), {
    context: { actingUserID: null },
  });

  expect(result).toStrictEqual({ checkpoints: [], elapsed: 0 });
});

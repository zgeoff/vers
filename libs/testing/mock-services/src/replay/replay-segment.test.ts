import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { createMockReplaySegmentInput } from '../test-utils/factories/create-mock-replay-segment-input';
import { replaySegment } from './replay-segment';

test('it replays any segment as a canned empty success', async () => {
  const result = await call(replaySegment, createMockReplaySegmentInput(), {
    context: { actingUserId: null },
  });

  expect(result).toStrictEqual({ checkpoints: [], elapsed: 0 });
});

import { expect, test } from 'bun:test';
import { liveRunSchema } from './live-run-schema';

test('it accepts a run naming its avatar and scope', () => {
  const run = {
    avatarID: 'avatar_1',
    id: 'activity_1',
    scopeID: '0_0',
    scopeType: 'world_map_node',
  };

  expect(liveRunSchema.parse(run)).toStrictEqual(run);
});

test('it rejects a run with no scope id', () => {
  const result = liveRunSchema.safeParse({
    avatarID: 'avatar_1',
    id: 'activity_1',
    scopeType: 'world_map_node',
  });

  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['scopeID'] }));
});

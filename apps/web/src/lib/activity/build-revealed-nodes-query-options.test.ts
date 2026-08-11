import { expect, test } from 'bun:test';
import { buildRevealedNodesQueryOptions } from './build-revealed-nodes-query-options';

test('it keys the query by avatar id and viewport, with a sensible staleTime', () => {
  const viewport = { maxCX: 16, maxCY: 16, minCX: 0, minCY: 0 };
  const options = buildRevealedNodesQueryOptions('avatar_1', viewport);

  expect(options.queryKey as unknown).toStrictEqual([
    ['getRevealedNodes'],
    { input: { avatarID: 'avatar_1', viewport }, type: 'query' },
  ]);

  expect(options.staleTime).toBe(30_000);
});

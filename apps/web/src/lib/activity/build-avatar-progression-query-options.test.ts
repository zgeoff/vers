import { expect, test } from 'bun:test';
import { buildAvatarProgressionQueryOptions } from './build-avatar-progression-query-options';

test('it polls on the relaxed interval when nothing is waiting to settle', () => {
  const options = buildAvatarProgressionQueryOptions('avatar_1');

  expect(options.refetchInterval({ state: { data: { pending: [] } } })).toBe(10_000);
});

test('it tightens the poll while an entry is waiting to settle', () => {
  const options = buildAvatarProgressionQueryOptions('avatar_1');

  expect(
    options.refetchInterval({
      state: { data: { pending: [{ activityID: 'act_1', xpDelta: 40 }] } },
    }),
  ).toBe(2000);
});

test('it polls on the relaxed interval before the first response lands', () => {
  const options = buildAvatarProgressionQueryOptions('avatar_1');

  expect(options.refetchInterval({ state: {} })).toBe(10_000);
});

test('it polls on the relaxed interval for an avatar the caller does not own', () => {
  const options = buildAvatarProgressionQueryOptions('avatar_1');

  expect(options.refetchInterval({ state: { data: null } })).toBe(10_000);
});

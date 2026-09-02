import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { wake } from './wake';

test('it wakes as a canned drained: 0 success', async () => {
  const result = await call(wake, {}, { context: { actingUserID: null } });

  expect(result).toStrictEqual({ drained: 0 });
});

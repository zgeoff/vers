import { expect, test } from 'bun:test';
import { readFailureActionCache } from './read-failure-action-cache';

test('it returns undefined when nothing has been cached', async () => {
  const stored = await readFailureActionCache();

  expect(stored).toBeUndefined();
});

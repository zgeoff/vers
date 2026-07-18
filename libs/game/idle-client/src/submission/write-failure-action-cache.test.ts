import { expect, test } from 'bun:test';
import { ActivityFailureAction } from '@vers/idle-core';
import { readFailureActionCache } from './read-failure-action-cache';
import { writeFailureActionCache } from './write-failure-action-cache';

test('it stores the preference retrievable by the cache read', async () => {
  await writeFailureActionCache({ dirty: true, failureAction: ActivityFailureAction.Retry });

  const stored = await readFailureActionCache();

  expect(stored).toStrictEqual({ dirty: true, failureAction: ActivityFailureAction.Retry });
});

test('it overwrites a previously cached preference', async () => {
  await writeFailureActionCache({ dirty: true, failureAction: ActivityFailureAction.Retry });
  await writeFailureActionCache({ dirty: false, failureAction: ActivityFailureAction.Abort });

  const stored = await readFailureActionCache();

  expect(stored).toStrictEqual({ dirty: false, failureAction: ActivityFailureAction.Abort });
});

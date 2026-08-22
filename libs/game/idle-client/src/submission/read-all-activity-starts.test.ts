import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readAllActivityStarts } from './read-all-activity-starts';
import { writeActivityStart } from './write-activity-start';

test('it reads every pending activityStart across avatars', async () => {
  const first = createMockActivityData();
  const second = createMockActivityData();

  await writeActivityStart(first);
  await writeActivityStart(second);

  const rows = await readAllActivityStarts();

  expect(rows).toIncludeSameMembers([first, second]);
});

test('it reads nothing when no pending activityStart is cached', async () => {
  const rows = await readAllActivityStarts();

  expect(rows).toStrictEqual([]);
});

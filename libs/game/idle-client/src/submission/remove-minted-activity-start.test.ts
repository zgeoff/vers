import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readAllActivityStarts } from './read-all-activity-starts';
import { readLastStartedActivity } from './read-last-started-activity';
import { removeMintedActivityStart } from './remove-minted-activity-start';
import { writeMintedActivityStart } from './write-minted-activity-start';

test('it removes the start row and records its predecessor as the last-started activity', async () => {
  const row = createMockActivityData({
    avatarID: 'avatar_rewound',
    id: 'act_rewound',
    predecessorActivityID: 'act_kept',
  });

  await writeMintedActivityStart(row);
  await removeMintedActivityStart(row);

  const starts = await readAllActivityStarts();
  const lastStarted = await readLastStartedActivity('avatar_rewound');

  expect(starts).toStrictEqual([]);
  expect(lastStarted).toStrictEqual({ avatarID: 'avatar_rewound', lastActivityID: 'act_kept' });
});

test('it removes the last-started record with a start row that has no predecessor', async () => {
  const row = createMockActivityData({
    avatarID: 'avatar_first_run',
    id: 'act_first_run',
    predecessorActivityID: null,
  });

  await writeMintedActivityStart(row);
  await removeMintedActivityStart(row);

  const starts = await readAllActivityStarts();
  const lastStarted = await readLastStartedActivity('avatar_first_run');

  expect(starts).toStrictEqual([]);
  expect(lastStarted).toBeUndefined();
});

test("it never removes another avatar's start row or last-started record", async () => {
  const removed = createMockActivityData({ avatarID: 'avatar_removed', id: 'act_removed' });
  const kept = createMockActivityData({ avatarID: 'avatar_kept', id: 'act_other' });

  await writeMintedActivityStart(removed);
  await writeMintedActivityStart(kept);
  await removeMintedActivityStart(removed);

  const starts = await readAllActivityStarts();
  const lastStarted = await readLastStartedActivity('avatar_kept');

  expect(starts).toStrictEqual([kept]);
  expect(lastStarted).toStrictEqual({ avatarID: 'avatar_kept', lastActivityID: 'act_other' });
});

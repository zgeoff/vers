import { expect, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { readAllActivityStarts } from './read-all-activity-starts';
import { readLastStartedActivity } from './read-last-started-activity';
import { writeLastStartedActivity } from './write-last-started-activity';
import { writeMintedActivityStart } from './write-minted-activity-start';

test("it writes the start row and records it as its avatar's last-started activity", async () => {
  const row = createMockActivityData({ avatarID: 'avatar_minted', id: 'act_minted' });

  await writeMintedActivityStart(row);

  const starts = await readAllActivityStarts();
  const lastStarted = await readLastStartedActivity('avatar_minted');

  expect(starts).toStrictEqual([row]);
  expect(lastStarted).toStrictEqual({ avatarID: 'avatar_minted', lastActivityID: 'act_minted' });
});

test('it keeps the previous last-started record when the start row write is interrupted', async () => {
  await writeLastStartedActivity({ avatarID: 'avatar_interrupted', lastActivityID: 'act_before' });

  // a function is a value the structured clone refuses, so the row's write fails after the
  // last-started record's write is already queued in the same transaction
  const unclonable = {
    ...createMockActivityData({ avatarID: 'avatar_interrupted', id: 'act_interrupted' }),
    onInstall: () => {},
  };

  const failure = await writeMintedActivityStart(unclonable).then(
    () => null,
    (error: unknown) => error,
  );

  const starts = await readAllActivityStarts();
  const lastStarted = await readLastStartedActivity('avatar_interrupted');

  expect(failure).toMatchObject({ name: 'DataCloneError' });
  expect(starts).toStrictEqual([]);

  expect(lastStarted).toStrictEqual({
    avatarID: 'avatar_interrupted',
    lastActivityID: 'act_before',
  });
});

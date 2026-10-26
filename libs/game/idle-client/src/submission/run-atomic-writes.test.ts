import { expect, test } from 'bun:test';
import { PREFERENCES_STORE_NAME } from './constants';
import { readLastStartedActivity } from './read-last-started-activity';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';
import { runAtomicWrites } from './run-atomic-writes';

test('it commits every write in the transaction', async () => {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(PREFERENCES_STORE_NAME, 'readwrite');

  await runAtomicWrites(tx, [
    () =>
      tx.store.put(
        { avatarID: 'avatar_one', lastActivityID: 'act_one' },
        'last-started-activity:avatar_one',
      ),
    () =>
      tx.store.put(
        { avatarID: 'avatar_two', lastActivityID: 'act_two' },
        'last-started-activity:avatar_two',
      ),
  ]);

  const first = await readLastStartedActivity('avatar_one');
  const second = await readLastStartedActivity('avatar_two');

  expect(first).toStrictEqual({ avatarID: 'avatar_one', lastActivityID: 'act_one' });
  expect(second).toStrictEqual({ avatarID: 'avatar_two', lastActivityID: 'act_two' });
});

test('it commits no write when a later write throws as it is issued', async () => {
  const db = await resolveCheckpointQueueDB();

  const tx = db.transaction(PREFERENCES_STORE_NAME, 'readwrite');

  // a function is a value the structured clone refuses
  const unclonable = {
    avatarID: 'avatar_refused',
    lastActivityID: 'act_refused',
    onRead: () => {},
  };

  const failure = await runAtomicWrites(tx, [
    () =>
      tx.store.put(
        { avatarID: 'avatar_issued', lastActivityID: 'act_issued' },
        'last-started-activity:avatar_issued',
      ),
    () => tx.store.put(unclonable, 'last-started-activity:avatar_refused'),
  ]).then(
    () => null,
    (error: unknown) => error,
  );

  const issued = await readLastStartedActivity('avatar_issued');

  expect(failure).toMatchObject({ name: 'DataCloneError' });
  expect(issued).toBeUndefined();
});

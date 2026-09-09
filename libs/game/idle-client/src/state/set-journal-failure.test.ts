import { expect, test } from 'bun:test';
import { setJournalFailure } from './set-journal-failure';
import { useIdleStore } from './use-idle-store';

test('it records and clears the journal failure wholesale', () => {
  setJournalFailure({ activityID: 'activity_1', kind: 'quota', receivedVersion: null });

  expect(useIdleStore.getState().journalFailure).toStrictEqual({
    activityID: 'activity_1',
    kind: 'quota',
    receivedVersion: null,
  });

  setJournalFailure(null);

  expect(useIdleStore.getState().journalFailure).toBeNull();
});

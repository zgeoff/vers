import { expect, test } from 'bun:test';
import { createMockJournalFailure } from '../test-utils/factories/create-mock-journal-failure';
import { setJournalFailure } from './set-journal-failure';
import { useIdleStore } from './use-idle-store';

test('it records and clears the journal failure wholesale', () => {
  const failure = createMockJournalFailure({ kind: 'quota', receivedVersion: null });

  setJournalFailure(failure);

  expect(useIdleStore.getState().journalFailure).toStrictEqual(failure);

  setJournalFailure(null);

  expect(useIdleStore.getState().journalFailure).toBeNull();
});

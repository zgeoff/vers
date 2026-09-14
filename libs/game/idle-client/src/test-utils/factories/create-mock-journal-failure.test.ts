import { expect, test } from 'bun:test';
import { createMockJournalFailure } from './create-mock-journal-failure';

test('it builds a default journal failure', () => {
  const failure = createMockJournalFailure();

  expect(failure).toStrictEqual({
    activityID: expect.toBeString(),
    kind: 'write',
    receivedVersion: expect.toBeNumber(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const failure = createMockJournalFailure({ kind: 'unreadable', receivedVersion: null });

  expect(failure).toStrictEqual({
    activityID: expect.toBeString(),
    kind: 'unreadable',
    receivedVersion: null,
  });
});

import { expect, test } from 'bun:test';
import { JournalWriteError } from './journal-write-error';

test('it classifies an exhausted quota by the browser error name', () => {
  const cause = new DOMException('quota', 'QuotaExceededError');
  const error = new JournalWriteError('activity_1', cause);

  expect(error).toMatchObject({
    activityID: 'activity_1',
    cause,
    kind: 'quota',
    name: 'JournalWriteError',
  });
});

test('it classifies any other rejection as a write failure', () => {
  const error = new JournalWriteError('activity_1', new Error('transaction aborted'));

  expect(error.kind).toBe('write');
  expect(error.message).toBe('journal write failed for activity activity_1: write');
});

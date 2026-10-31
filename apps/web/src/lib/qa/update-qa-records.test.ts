import { expect, onTestFinished, test } from 'bun:test';
import { updateQARecords } from './update-qa-records';

test('it writes the update of the stored records', () => {
  sessionStorage.setItem('vers-qa-test-records', '[1,2]');

  onTestFinished(() => {
    sessionStorage.removeItem('vers-qa-test-records');
  });

  updateQARecords({
    key: 'vers-qa-test-records',
    storage: sessionStorage,
    update: (records) => [...records, 3],
  });

  expect(sessionStorage.getItem('vers-qa-test-records')).toBe('[1,2,3]');
});

test('it updates a missing key from no records', () => {
  onTestFinished(() => {
    sessionStorage.removeItem('vers-qa-test-records');
  });

  updateQARecords({
    key: 'vers-qa-test-records',
    storage: sessionStorage,
    update: (records) => [...records, 1],
  });

  expect(sessionStorage.getItem('vers-qa-test-records')).toBe('[1]');
});

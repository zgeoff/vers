import { expect, onTestFinished, test } from 'bun:test';
import { writeQARecord } from './write-qa-record';

test('it appends a record after the stored ones', () => {
  sessionStorage.setItem('vers-qa-test-records', '[1]');

  onTestFinished(() => {
    sessionStorage.removeItem('vers-qa-test-records');
  });

  writeQARecord({ key: 'vers-qa-test-records', maxRecords: 3, record: 2, storage: sessionStorage });

  expect(sessionStorage.getItem('vers-qa-test-records')).toBe('[1,2]');
});

test('it drops the oldest records past the maximum', () => {
  sessionStorage.setItem('vers-qa-test-records', '[1,2,3]');

  onTestFinished(() => {
    sessionStorage.removeItem('vers-qa-test-records');
  });

  writeQARecord({ key: 'vers-qa-test-records', maxRecords: 3, record: 4, storage: sessionStorage });

  expect(sessionStorage.getItem('vers-qa-test-records')).toBe('[2,3,4]');
});

import { expect, onTestFinished, test } from 'bun:test';
import { readQARecords } from './read-qa-records';

test('it reads the stored records', () => {
  sessionStorage.setItem('vers-qa-test-records', '[{"kind":"completed"}]');

  onTestFinished(() => {
    sessionStorage.removeItem('vers-qa-test-records');
  });

  expect(readQARecords(sessionStorage, 'vers-qa-test-records')).toStrictEqual([
    { kind: 'completed' },
  ]);
});

test('it reads a missing key as no records', () => {
  expect(readQARecords(sessionStorage, 'vers-qa-test-records')).toStrictEqual([]);
});

test('it reads a value that is not JSON as no records', () => {
  sessionStorage.setItem('vers-qa-test-records', '{not json');

  onTestFinished(() => {
    sessionStorage.removeItem('vers-qa-test-records');
  });

  expect(readQARecords(sessionStorage, 'vers-qa-test-records')).toStrictEqual([]);
});

test('it reads a JSON value that is not a list as no records', () => {
  sessionStorage.setItem('vers-qa-test-records', '{"kind":"completed"}');

  onTestFinished(() => {
    sessionStorage.removeItem('vers-qa-test-records');
  });

  expect(readQARecords(sessionStorage, 'vers-qa-test-records')).toStrictEqual([]);
});

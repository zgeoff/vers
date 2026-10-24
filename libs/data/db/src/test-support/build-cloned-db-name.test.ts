import { expect, test } from 'bun:test';
import { buildClonedDBName } from './build-cloned-db-name';

test('it names the clone after the process that owns it', () => {
  expect(buildClonedDBName()).toStartWith(`test_pid_${process.pid}_`);
});

test('it builds a safe identifier within the postgres length limit', () => {
  const dbName = buildClonedDBName();

  expect(dbName).toMatch(/^[a-z0-9_]{1,63}$/u);
});

test('it builds a new name on each call', () => {
  expect(buildClonedDBName()).not.toBe(buildClonedDBName());
});

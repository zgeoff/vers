import { expect, test } from 'bun:test';
import { buildClonedDBName } from './build-cloned-db-name';

test('it names the clone after its owner and the process that owns it', () => {
  expect(buildClonedDBName('test_pid_owner_')).toStartWith(`test_pid_owner_${process.pid}_`);
});

test('it builds a safe identifier within the postgres length limit', () => {
  const dbName = buildClonedDBName('test_pid_0123abcd_');

  expect(dbName).toMatch(/^[a-z0-9_]{1,63}$/u);
});

test('it builds a new name on each call', () => {
  expect(buildClonedDBName('test_pid_owner_')).not.toBe(buildClonedDBName('test_pid_owner_'));
});

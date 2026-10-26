import { expect, test } from 'bun:test';
import { parseLockWaits } from './parse-lock-waits';

test('it counts each wait past the deadlock timeout and the time each granted wait took', () => {
  const log = [
    'postgres-1  | 2026-10-26 04:30:24.996 UTC [88] LOG:  process 88 still waiting for ShareLock on transaction 1204 after 100.112 ms',
    'postgres-1  | 2026-10-26 04:30:25.120 UTC [88] LOG:  process 88 acquired ShareLock on transaction 1204 after 224.501 ms',
    'postgres-1  | 2026-10-26 04:30:26.004 UTC [91] LOG:  process 91 still waiting for RowExclusiveLock on relation 16420 of database 16384 after 100.020 ms',
    'postgres-1  | 2026-10-26 04:30:26.100 UTC [91] LOG:  checkpoint starting: time',
  ].join('\n');

  expect(parseLockWaits(log)).toStrictEqual({
    acquiredAfterMs: [224.501],
    byLock: { 'RowExclusiveLock on relation': 1, 'ShareLock on transaction': 1 },
    waits: 2,
  });
});

test('it reads a log with no lock waits as none', () => {
  expect(
    parseLockWaits('postgres-1  | LOG:  database system is ready to accept connections'),
  ).toStrictEqual({
    acquiredAfterMs: [],
    byLock: {},
    waits: 0,
  });
});

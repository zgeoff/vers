import { expect, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { createFakeWebLocks } from './create-fake-web-locks';

test('it grants a free lock synchronously', () => {
  const fake = createFakeWebLocks();
  let granted = false;

  void fake.locks.request('lock', { mode: 'exclusive' }, () => {
    granted = true;

    return new Promise<void>(() => {});
  });

  expect(granted).toBeTrue();
});

test('it queues a second requester behind a live holder', () => {
  const fake = createFakeWebLocks();
  let secondGranted = false;

  void fake.locks.request('lock', { mode: 'exclusive' }, () => new Promise<void>(() => {}));

  void fake.locks.request('lock', { mode: 'exclusive' }, () => {
    secondGranted = true;

    return new Promise<void>(() => {});
  });

  expect(secondGranted).toBeFalse();
});

test('it releases the lock when the granted callback settles', async () => {
  const fake = createFakeWebLocks();
  const holderControl = Promise.withResolvers<void>();
  const holderDone = fake.locks.request('lock', { mode: 'exclusive' }, () => holderControl.promise);
  let secondGranted = false;

  void fake.locks.request('lock', { mode: 'exclusive' }, () => {
    secondGranted = true;

    return new Promise<void>(() => {});
  });

  holderControl.resolve();

  await holderDone;

  await waitFor(() => {
    expect(secondGranted).toBeTrue();
  });
});

test('it grants queued waiters first-in-first-out on a forced release', () => {
  const fake = createFakeWebLocks();
  const granted: Array<string> = [];

  void fake.locks.request('lock', { mode: 'exclusive' }, () => {
    granted.push('first');

    return new Promise<void>(() => {});
  });

  void fake.locks.request('lock', { mode: 'exclusive' }, () => {
    granted.push('second');

    return new Promise<void>(() => {});
  });

  void fake.locks.request('lock', { mode: 'exclusive' }, () => {
    granted.push('third');

    return new Promise<void>(() => {});
  });

  fake.advanceLockQueue('lock');

  expect(granted).toStrictEqual(['first', 'second']);

  fake.advanceLockQueue('lock');

  expect(granted).toStrictEqual(['first', 'second', 'third']);
});

test('it scopes queues by lock name', () => {
  const fake = createFakeWebLocks();
  const granted: Array<string> = [];

  void fake.locks.request('lock-a', { mode: 'exclusive' }, () => {
    granted.push('a');

    return new Promise<void>(() => {});
  });

  void fake.locks.request('lock-b', { mode: 'exclusive' }, () => {
    granted.push('b');

    return new Promise<void>(() => {});
  });

  expect(granted).toStrictEqual(['a', 'b']);
});

import { expect, test } from 'bun:test';
import { createFakeWebLocks } from '../test-utils/create-fake-web-locks';
import { startWriterElection } from './start-writer-election';

test('it elects the first requester while the lock is free', () => {
  const fake = createFakeWebLocks();
  let elected = 0;

  startWriterElection({
    locks: fake.locks,
    onElected: () => {
      elected += 1;
    },
  });

  expect(elected).toBe(1);
});

test('it keeps a later requester waiting while the writer lives', () => {
  const fake = createFakeWebLocks();
  const elected: Array<string> = [];

  startWriterElection({
    locks: fake.locks,
    onElected: () => {
      elected.push('first');
    },
  });

  startWriterElection({
    locks: fake.locks,
    onElected: () => {
      elected.push('second');
    },
  });

  expect(elected).toStrictEqual(['first']);
});

test('it promotes the next waiter when the holder is released', () => {
  const fake = createFakeWebLocks();
  const elected: Array<string> = [];

  startWriterElection({
    locks: fake.locks,
    onElected: () => {
      elected.push('first');
    },
  });

  startWriterElection({
    locks: fake.locks,
    onElected: () => {
      elected.push('second');
    },
  });

  fake.advanceLockQueue('vers-idle-writer');

  expect(elected).toStrictEqual(['first', 'second']);
});

test('it never releases the lock on its own', async () => {
  const fake = createFakeWebLocks();
  let secondElected = false;

  startWriterElection({ locks: fake.locks, onElected: () => {} });

  startWriterElection({
    locks: fake.locks,
    onElected: () => {
      secondElected = true;
    },
  });

  // give any wrongly-settled holder promise a chance to release the lock and promote
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });

  expect(secondElected).toBeFalse();
});

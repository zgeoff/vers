import { expect, test } from 'bun:test';
import { assertEventually } from './assert-eventually';

test('it returns as soon as the assertion passes', async () => {
  let calls = 0;

  await assertEventually(() => {
    calls += 1;
  });

  expect(calls).toBe(1);
});

test('it retries until a later state change makes the assertion pass', async () => {
  let ready = false;

  setTimeout(() => {
    ready = true;
  }, 30);

  await assertEventually(() => {
    expect(ready).toBeTrue();
  });

  expect(ready).toBeTrue();
});

test('it rethrows the last failure once the timeout lapses', async () => {
  const promise = assertEventually(() => {
    expect(false).toBeTrue();
  }, 50);

  await expect(promise).toReject();
});

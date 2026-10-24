import { expect, test } from 'bun:test';
import { withDeadline } from './with-deadline';

test('it returns what the action resolves to before the deadline', () => {
  expect(
    withDeadline(() => Promise.resolve('recorded'), {
      afterMs: 1000,
      label: 'vers-app-sample release record',
    }),
  ).resolves.toBe('recorded');
});

test('it fails with the label and the bound when the action never finishes', () => {
  const pending = Promise.withResolvers<never>();

  expect(
    withDeadline(() => pending.promise, { afterMs: 50, label: 'vers-app-sample release record' }),
  ).rejects.toThrowWithMessage(Error, 'vers-app-sample release record did not finish within 50 ms');
});

test('it passes on the rejection of an action that fails before the deadline', () => {
  expect(
    withDeadline(() => Promise.reject(new Error('connection refused')), {
      afterMs: 1000,
      label: 'vers-app-sample release record',
    }),
  ).rejects.toThrowWithMessage(Error, 'connection refused');
});

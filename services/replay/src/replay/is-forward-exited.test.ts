import { expect, test } from 'bun:test';
import { isForwardExited } from './is-forward-exited';

test('it reports forward-exited for a completed tail on an active activity', () => {
  expect(isForwardExited('completed', 'active')).toBeTrue();
});

test('it reports forward-exited for a failed tail on an active activity', () => {
  expect(isForwardExited('failed', 'active')).toBeTrue();
});

test('it reports forward-exited for a progress tail on a stopped activity', () => {
  expect(isForwardExited('progress', 'stopped')).toBeTrue();
});

test('it reports forward-exited for a progress tail on a capped activity', () => {
  expect(isForwardExited('progress', 'capped')).toBeTrue();
});

test('it reports not forward-exited for a progress tail on an active activity', () => {
  expect(isForwardExited('progress', 'active')).toBeFalse();
});

test('it reports not forward-exited for a started-only tail on a stopped activity', () => {
  expect(isForwardExited('started', 'stopped')).toBeFalse();
});

test('it reports not forward-exited for a started-only tail on a capped activity', () => {
  expect(isForwardExited('started', 'capped')).toBeFalse();
});

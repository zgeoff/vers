import { expect, test } from 'bun:test';
import { isAbortError } from './is-abort-error';

test('it reports false while the signal is not aborted', () => {
  const controller = new AbortController();

  expect(isAbortError(new Error('boom'), controller.signal)).toBeFalse();
});

test('it reports true for the signal reason once aborted', () => {
  const controller = new AbortController();

  controller.abort();

  expect(isAbortError(controller.signal.reason, controller.signal)).toBeTrue();
});

test('it reports true for a platform AbortError once aborted', () => {
  const controller = new AbortController();

  controller.abort();

  expect(isAbortError(new DOMException('aborted', 'AbortError'), controller.signal)).toBeTrue();
});

test('it reports false for an unrelated error once aborted', () => {
  const controller = new AbortController();

  controller.abort();

  expect(isAbortError(new Error('unrelated'), controller.signal)).toBeFalse();
});

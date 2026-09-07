import { expect, test } from 'bun:test';
import { isViewTransitionAbort } from './is-view-transition-abort';

test('it matches the InvalidStateError a navigation-aborted view transition raises', () => {
  const error = new DOMException(
    'Transition was aborted because of invalid state',
    'InvalidStateError',
  );

  expect(isViewTransitionAbort(error)).toBeTrue();
});

test('it does not match an InvalidStateError with another message', () => {
  const error = new DOMException('The object is in an invalid state.', 'InvalidStateError');

  expect(isViewTransitionAbort(error)).toBeFalse();
});

test('it does not match the abort message under another DOMException name', () => {
  const error = new DOMException('Transition was aborted because of invalid state', 'AbortError');

  expect(isViewTransitionAbort(error)).toBeFalse();
});

test('it does not match a plain Error carrying the abort message', () => {
  const error = new Error('Transition was aborted because of invalid state');

  expect(isViewTransitionAbort(error)).toBeFalse();
});

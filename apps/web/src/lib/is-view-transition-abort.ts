// the browser aborts document.startViewTransition when the document unloads mid-transition, so a
// hard navigation during a router transition raises this exact DOMException in every tab
const VIEW_TRANSITION_ABORT_MESSAGE = 'Transition was aborted because of invalid state';

export function isViewTransitionAbort(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === 'InvalidStateError' &&
    error.message === VIEW_TRANSITION_ABORT_MESSAGE
  );
}

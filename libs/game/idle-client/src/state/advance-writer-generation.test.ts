import { expect, test } from 'bun:test';
import { advanceWriterGeneration } from './advance-writer-generation';
import { useIdleStore } from './use-idle-store';

test('it ticks the generation and resets the handshake in one transition', () => {
  useIdleStore.setState({ initialized: true });

  advanceWriterGeneration();

  expect(useIdleStore.getState().writerGeneration).toBe(1);
  expect(useIdleStore.getState().initialized).toBeFalse();

  advanceWriterGeneration();

  expect(useIdleStore.getState().writerGeneration).toBe(2);
});

test('it aborts the previous abort controller and replaces it with a fresh one', () => {
  const previous = useIdleStore.getState().writerAbortController;

  advanceWriterGeneration();

  const current = useIdleStore.getState().writerAbortController;

  expect(previous.signal.aborted).toBeTrue();
  expect(current).not.toBe(previous);
  expect(current.signal.aborted).toBeFalse();
});

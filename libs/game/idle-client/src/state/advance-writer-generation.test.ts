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

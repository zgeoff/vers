import { expect, test } from 'bun:test';
import { setWriterContention } from './set-writer-contention';
import { useIdleStore } from './use-idle-store';

test('it records and clears the writer contention flag', () => {
  setWriterContention(true);

  expect(useIdleStore.getState().writerContention).toBeTrue();

  setWriterContention(false);

  expect(useIdleStore.getState().writerContention).toBeFalse();
});

import { expect, test } from 'bun:test';
import { setWriterDisplacedActivityID } from './set-writer-displaced-activity-id';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored displaced activity wholesale, including clearing it', () => {
  setWriterDisplacedActivityID('activity-1');
  expect(useIdleStore.getState().writerDisplacedActivityID).toBe('activity-1');
  setWriterDisplacedActivityID(null);
  expect(useIdleStore.getState().writerDisplacedActivityID).toBeNull();
});

import { expect, test } from 'bun:test';
import { setEngagedActivityID } from './set-engaged-activity-id';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored engaged activity wholesale, including clearing it', () => {
  setEngagedActivityID('activity-1');

  expect(useIdleStore.getState().engagedActivityID).toBe('activity-1');

  setEngagedActivityID(null);

  expect(useIdleStore.getState().engagedActivityID).toBeNull();
});

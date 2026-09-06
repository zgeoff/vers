import { expect, test } from 'bun:test';
import { createMockLiveRun } from '../test-utils/factories/create-mock-live-run';
import { setEngagedRun } from './set-engaged-run';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored engaged run wholesale, including clearing it', () => {
  const run = createMockLiveRun();

  setEngagedRun(run);

  expect(useIdleStore.getState().engagedRun).toStrictEqual(run);

  setEngagedRun(null);

  expect(useIdleStore.getState().engagedRun).toBeNull();
});

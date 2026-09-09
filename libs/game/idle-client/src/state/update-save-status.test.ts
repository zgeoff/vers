import { expect, test } from 'bun:test';
import { updateSaveStatus } from './update-save-status';
import { useIdleStore } from './use-idle-store';

test('it keeps the saved cursor when only the received cursor moves', () => {
  updateSaveStatus({ activityID: 'activity_1', receivedVersion: null, savedVersion: 4 });
  updateSaveStatus({ activityID: 'activity_1', receivedVersion: 3, savedVersion: null });

  expect(useIdleStore.getState().saveStatus).toStrictEqual({
    activityID: 'activity_1',
    receivedVersion: 3,
    savedVersion: 4,
  });
});

test('it starts a fresh pair when a report names another activity', () => {
  updateSaveStatus({ activityID: 'activity_1', receivedVersion: 3, savedVersion: 4 });
  updateSaveStatus({ activityID: 'activity_2', receivedVersion: null, savedVersion: 1 });

  expect(useIdleStore.getState().saveStatus).toStrictEqual({
    activityID: 'activity_2',
    receivedVersion: null,
    savedVersion: 1,
  });
});

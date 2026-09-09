import type { SaveStatus } from '../types';
import { useIdleStore } from './use-idle-store';

// the worker reports a save and a server receipt as separate events, each naming only the cursor it
// moved; a report for another activity replaces the pair, since the display follows the live run
export function updateSaveStatus(report: Readonly<SaveStatus>) {
  useIdleStore.setState((state) => {
    const previous =
      state.saveStatus !== null && state.saveStatus.activityID === report.activityID
        ? state.saveStatus
        : { activityID: report.activityID, receivedVersion: null, savedVersion: null };

    return {
      saveStatus: {
        activityID: report.activityID,
        receivedVersion: report.receivedVersion ?? previous.receivedVersion,
        savedVersion: report.savedVersion ?? previous.savedVersion,
      },
    };
  });
}

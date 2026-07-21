import type { ReportOnlineMessage } from './client-to-worker-message-schema';
import { reportWorkerFault } from './report-worker-fault';
import { runReconnectRecovery } from './run-reconnect-recovery';
import type { WorkerContext } from './types';

/**
 * A tab's connectivity report: marks the connection online, then runs the reconnect recovery with
 * the session avatar the tab names — the worker alone decides whether a catch-up follows. Failures
 * report under the same fault site as the worker's own online-event recoveries, so tab-relayed
 * reconnect faults group with them rather than with routing faults.
 */
export async function handleReportOnlineMessage(
  context: WorkerContext,
  message: ReportOnlineMessage,
): Promise<void> {
  context.updateConnectivity(true);

  try {
    await runReconnectRecovery(context, message.avatarID, message.claim);
  } catch (error) {
    reportWorkerFault('reconnect', error);
  }
}

import { reportWorkerFault } from './report-worker-fault';
import { runReconnectRecovery } from './run-reconnect-recovery';
import type { WorkerContext } from './types';

interface ReportOnlineInput {
  readonly avatarID: string;
  readonly claim: boolean;
}

/**
 * A tab's connectivity report: marks the connection online, then runs the reconnect recovery with
 * the session avatar the tab names — the worker alone decides whether a catch-up follows. Failures
 * report under the same fault site as the worker's own online-event recoveries, so tab-relayed
 * reconnect faults group with them rather than with routing faults.
 */
export async function handleReportOnlineMessage(
  context: WorkerContext,
  input: Readonly<ReportOnlineInput>,
): Promise<void> {
  context.updateConnectivity(true);

  try {
    await runReconnectRecovery(context, input.avatarID, input.claim);
  } catch (error) {
    reportWorkerFault('reconnect', error);
  }
}

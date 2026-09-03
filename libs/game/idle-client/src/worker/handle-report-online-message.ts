import { reportWorkerFault } from './report-worker-fault';
import { runReconnectRecovery } from './run-reconnect-recovery';
import type { WorkerContext } from './types';

interface ReportOnlineInput {
  readonly avatarID: string;
  readonly claim: boolean;
}

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

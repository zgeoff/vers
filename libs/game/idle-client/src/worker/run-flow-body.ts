import type { WorkerFaultSite } from './report-worker-fault';
import { reportWorkerFault } from './report-worker-fault';

export async function runFlowBody(site: WorkerFaultSite, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    reportWorkerFault(site, error);
  }
}

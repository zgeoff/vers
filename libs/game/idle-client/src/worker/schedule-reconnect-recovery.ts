import { reportWorkerFault } from './report-worker-fault';
import { runReconnectRecovery } from './run-reconnect-recovery';
import type { WorkerLifecycleContext } from './types';

export function scheduleReconnectRecovery(context: WorkerLifecycleContext): void {
  void (async () => {
    try {
      await context.failureActionSeeded;
      await runReconnectRecovery(context.runtime);
    } catch (error) {
      reportWorkerFault('reconnect', error);
    }
  })();
}
